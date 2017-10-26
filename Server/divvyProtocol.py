r"""
    ParaViewWeb protocol to satisfy RPC and publish/subscribe requests from Divvy

"""
from __future__ import absolute_import, division, print_function

import os

# import paraview modules.
from paraview.web.protocols import ParaViewWebProtocol
# import RPC annotation
from wslink import register as exportRpc

# data, math
import vtk, vtk.util.numpy_support
from vtk.util.numpy_support import vtk_to_numpy, numpy_to_vtk

import numpy as np

NUMERIC_TYPES = {
  'char': True,
  'unsigned_char': True,
  'short': True,
  'unsigned_short': True,
  'int': True,
  'unsigned_int': True,
  'long': True,
  'unsigned_long': True,
  'float': True,
  'double': True,
  'id_type': True,
  'signed_char': True
}

# =============================================================================
# Respond to all RPC requests and publish data to a Divvy client
# =============================================================================
class DivvyProtocol(ParaViewWebProtocol):
  def __init__(self, inputFile):
    super(DivvyProtocol, self).__init__()
    self.inputFile = inputFile
    self.dataTable = None
    # if we calc a full histogram, cache it
    self.hist2DCache = {}
    self.hist1DCache = {}
    # the active annotation defined which rows are selected.
    self.activeAnnot = None
    self.selectedRows = None
    # which pairs need 2D histograms of the active annotation?
    self.lastHist2DList = None
    self.numBins = 32

  # return a dictionary of numeric column names and their ranges.
  @exportRpc('divvy.fields.get')
  def getFields(self):
    if not self.dataTable:
      # read a data file
      r = vtk.vtkDelimitedTextReader()
      r.DetectNumericColumnsOn()
      r.SetFileName(self.inputFile)
      r.SetHaveHeaders(True)
      r.Update()
      self.dataTable = r.GetOutput()
    self.fields = {}
    self.columnNames = []
    self.numRows = self.dataTable.GetNumberOfRows()
    for i in range(self.dataTable.GetNumberOfColumns()):
      # Add a range for any numeric fields
      self.columnNames.append(self.dataTable.GetColumnName(i))
      arr = self.dataTable.GetColumn(i)
      if arr.GetDataTypeAsString() in NUMERIC_TYPES:
        self.fields[self.columnNames[i]] = { 'range': list(arr.GetRange()) }

    return self.fields

  def calc1DHistogram(self, vtkX, xrng, numBins):
    result = np.zeros(numBins)
    px = vtk_to_numpy(vtkX)
    ix = np.clip(np.floor((px - xrng[0]) * numBins / (xrng[1] - xrng[0])).astype(int), 0, numBins - 1)
    indices, counts = np.unique(ix, return_counts = True)
    for i in range(len(indices)):
      result[indices[i]] = counts[i]
    # make it json serializable
    return result.tolist()

  def get1DHistogram(self, key):
    numBins = self.numBins
    hist1D = None
    vtkX = self.dataTable.GetColumnByName(key)
    xrng = vtkX.GetRange()
    if xrng[0] == xrng[1]:
      xrng[1] += 1
    if key in self.hist1DCache:
      hist1D = self.hist1DCache[key]
    else:
      hist1D = self.calc1DHistogram(vtkX, xrng, numBins)
      self.hist1DCache[key] = hist1D
    result = {
      'name': key,
      'min': xrng[0],
      'max': xrng[1],
      'counts': hist1D,
    }

    return result


  def calc2DHistogram(self, key, numBins):
    result = np.zeros((numBins, numBins))
    print(key[0], key[1])
    vtkX = self.dataTable.GetColumnByName(key[0])
    vtkY = self.dataTable.GetColumnByName(key[1])
    xrng = vtkX.GetRange()
    yrng = vtkY.GetRange()

    px = vtk_to_numpy(vtkX)
    py = vtk_to_numpy(vtkY)
    # clip puts maximum values into the last bin
    ix = np.clip(np.floor((px - xrng[0]) * numBins / (xrng[1] - xrng[0])).astype(int), 0, numBins - 1)
    iy = np.clip(np.floor((py - yrng[0]) * numBins / (yrng[1] - yrng[0])).astype(int), 0, numBins - 1)
    for i, j in zip(ix, iy):
        result[i,j] += 1
    return result

  def format2DHistogramResult(self, pair, hist2D, annot=None, inScore=None, inVtkX=None, inVtkY=None, inXrng=None, inYrng=None):
    numBins = self.numBins
    vtkX = inVtkX if inVtkX else self.dataTable.GetColumnByName(pair[0])
    vtkY = inVtkY if inVtkY else self.dataTable.GetColumnByName(pair[1])
    xrng = inXrng if inXrng else vtkX.GetRange()
    yrng = inYrng if inYrng else vtkY.GetRange()
    score = inScore if inScore else 0
    dx = float(xrng[1] - xrng[0]) / numBins
    dy = float(yrng[1] - yrng[0]) / numBins

    histIter = np.nditer(hist2D, flags=['multi_index'])
    result = {
      'x': {'name': pair[0], 'extent':xrng, 'delta':dx, 'mtime': vtkX.GetMTime() },
      'y': {'name': pair[1], 'extent':yrng, 'delta':dy, 'mtime': vtkY.GetMTime() },
      'numberOfBins': numBins,
      'bins': [ {
                  'x':xrng[0] + histIter.multi_index[0] * dx,
                  'y':yrng[0] + histIter.multi_index[1] * dy,
                  'count':int(bval)
              } for bval in histIter if bval > 0 ],
    }
    if annot:
      result['annotationInfo'] = {
        'annotation': annot['id'] if 'id' in annot else 'unknown',
        'annotationGeneration': annot['generation'],
        'selectionGeneration': annot['selection']['generation']
      }
      result['role'] = { 'type': 'selected', 'score': score }
    else:
      result['role'] = { 'type': 'complete', 'score': -1 }
    return result


  def get2DHistogram(self, pair):
    numBins = self.numBins
    swap = pair[1] < pair[0]
    key = (pair[1], pair[0]) if swap else (pair[0], pair[1])
    hist2D = None
    if key in self.hist2DCache:
      hist2D = self.hist2DCache[key]
    else:
      hist2D = self.calc2DHistogram(key, numBins)
      self.hist2DCache[key] = hist2D
    if swap:
      hist2D = hist2D.T
    # Client expects a sparse representation => hist2Ds
    result = self.format2DHistogramResult(pair, hist2D)
    return result

  # given a list of pairs of names from self.fields, calc and publish 2D histograms
  @exportRpc('divvy.histograms.request')
  def requestHistograms(self, request):
    print(request)
    if 'hist2D' in request:
      for pair in request['hist2D']:
        result = self.get2DHistogram(pair)
        self.publish('divvy.histogram2D.push', { 'name': pair, 'data': result })
    if 'hist1D' in request:
      for field in request['hist1D']:
        result = self.get1DHistogram(field)
        self.publish('divvy.histogram1D.push', { 'name': field, 'data': result })

    return { 'success': True }

  # whenever the annotation changes, see if we can generate 2D histograms
  # for its selection from this list (for Parallel Coords)
  @exportRpc('divvy.histograms.annotation.request')
  def requestAnnotationHistograms(self, request):
    if 'hist2D' in request:
      self.lastHist2DList = request['hist2D']
    return { 'success': True }



  @exportRpc('divvy.annotation.update')
  def updateAnnotation(self, annot):
    numBins = self.numBins
    print(annot)
    prevAnnot = self.activeAnnot
    self.activeAnnot = annot
    # {
    #   'id': '301fc0e7-80fe-4f3d-9d77-bcffa8f8f3bc', 'generation': 2,
    #   'selection': {
    #     'type': 'range', 'generation': 2, 'range': {
    #     'variables': {
    #       'CH4': [{
    #         'interval': [0.0003562899441340782, 0.0009054340782122905], 'endpoints': '**'
    #         }]
    #       }
    #     }
    #   },
    #   'score': [0], 'weight': 1, 'rationale': '', 'name': 'CH4 (range)', 'readOnly': False
    # }
    # {
    # 'id': 'cb1178c0-1932-4856-9d58-4ca042a2e6d3', 'generation': 19,
    # 'selection': {
    #   'type': 'partition', 'generation': 19,
    #   'partition': {
    #     'variable': 'CH4', 'dividers': [{
    #       'value': 0.00018690694444444442, 'uncertainty': 0, 'closeToLeft': False}, {
    #       'value': 0.0007313749999999999, 'uncertainty': 0, 'closeToLeft': False}, {
    #       'value': 0.0010320513888888887, 'uncertainty': 0, 'closeToLeft': False}
    #     ]}
    #   },
    # 'score': [3, 0, 1, 4], 'weight': 1, 'rationale': '', 'name': 'CH4 (partition)', 'readOnly': False
    # }
    selectionType = annot['selection']['type']
    if selectionType == 'range':
      myVars = annot['selection']['range']['variables']
      annotScore = annot['score'][0] if len(annot['score']) > 0 else 0

      colResult = []
      for var in myVars:
        # retrieve the column
        vtkcol = self.dataTable.GetColumnByName(var);

        if not vtkcol:
          print('missing data column', vtkcol)
          continue
        col = vtk_to_numpy(vtkcol)
        insideInterval = []
        for region in myVars[var]:
          # data must be inside the interval. TODO: endpoint '*' is closed, 'o' is open.
          interval = region['interval'] if 'interval' in region else [0, 1]
          insideInterval.append(np.all([interval[0] <= col, col <= interval[1]], axis=0))
        # data can be inside any interval in this column
        colResult.append(np.any(insideInterval, axis=0))
      # Row must be inside all columns to be selected. Convert True/False to 1/0
      labeledRows = np.all(colResult, axis=0).astype(np.uint8)
      # Change selected rows to have their score as a label. If score ==0, need to flip.
      if annotScore == 0:
        labeledRows = (labeledRows * -1) + 1
      else:
        labeledRows *= annotScore
      self.selectedRows = { 'score': [annotScore], 'data': labeledRows.astype(np.uint8) }
      print('Selected row count:', np.sum(self.selectedRows['data'] == annotScore))
    elif selectionType == 'partition':
      # partitions label all the rows in a column with their scores.
      var = annot['selection']['partition']['variable']
      # retrieve the column
      vtkcol = self.dataTable.GetColumnByName(var);

      if not vtkcol:
        print('missing data column', vtkcol)
        return { 'success': False }

      col = vtk_to_numpy(vtkcol)
      dividers = annot['selection']['partition']['dividers']
      divVals = [d['value'] for d in dividers]

      # first determine which partition each row is in. For each divider, see if a row is underneath, and add to it's count
      # flip (via subtract) to label them inside partition 1, 2, 3 ...
      # TODO handle 'closeToLeft', which will use <=
      labeledRows = np.uint8(len(divVals) + 1) - np.sum([col < val for val in divVals], axis=0).astype(np.uint8)
      annotScores = annot['score']
      if len(annotScores) == len(divVals) + 1:
        # convert the region label to a score, via a map.
        scoreMap = { (i + 1): annotScores[i] for i in range(len(annotScores)) }
        labeledRows = np.array(list(map(lambda x: scoreMap[x] if x in scoreMap else 0, labeledRows))).astype(np.uint8)
      self.selectedRows = { 'score': np.unique(annotScores).tolist(), 'data': labeledRows }

    else:
      print('empty selection')
      self.selectedRows = { 'score': [-1], 'data': np.zeros(self.numRows) }

    # if someone is listening to hist2D selections....
    if self.lastHist2DList:
      # for range selections, this happens once. For partitions, several times.
      for score in self.selectedRows['score']:
        # find the indices of the selected rows (flagged with score)
        selIndices = np.where(np.isin(self.selectedRows['data'], [score]))
        for pair in self.lastHist2DList:

          vtkX = self.dataTable.GetColumnByName(pair[0])
          vtkY = self.dataTable.GetColumnByName(pair[1])
          xrng = vtkX.GetRange()
          yrng = vtkY.GetRange()
          x = vtk_to_numpy(vtkX)
          y = vtk_to_numpy(vtkY)
          dx = float(xrng[1] - xrng[0]) / numBins
          dy = float(yrng[1] - yrng[0]) / numBins
          # sub-set the columns to the selected rows, then calc histogram.
          bins = np.histogram2d(x[selIndices], y[selIndices], bins=numBins, range=[xrng, yrng])[0]
          result = self.format2DHistogramResult(pair, bins, annot, score, vtkX, vtkY, xrng, yrng)
          self.publish('divvy.histogram2D.push', { 'type': 'histogram2d', 'data': result, 'selection': True, })

    return { 'success': True }
