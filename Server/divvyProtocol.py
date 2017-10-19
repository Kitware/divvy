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
  def __init__(self):
    super(DivvyProtocol, self).__init__()
    self.dataTable = None
    self.hist2DCache = {};
    self.hist1DCache = {};

  # return a dictionary of numeric column names and their ranges.
  @exportRpc('divvy.fields.get')
  def getFields(self):
    if not self.dataTable:
      # read a data file
      r = vtk.vtkDelimitedTextReader()
      r.DetectNumericColumnsOn()
      r.SetFileName('nba13-14.csv')
      r.SetHaveHeaders(True)
      r.Update()
      self.dataTable = r.GetOutput()
    self.fields = {}
    self.columnNames = []
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
    numBins = 32
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

  def get2DHistogram(self, pair):
    numBins = 32
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
    m, n = np.where(hist2D > 0)
    hist2Ds = np.array([m, n, hist2D[m,n]]).T
    # Format bins for client
    vtkX = self.dataTable.GetColumnByName(pair[0])
    vtkY = self.dataTable.GetColumnByName(pair[1])
    xrng = vtkX.GetRange()
    yrng = vtkY.GetRange()
    dx = float(xrng[1] - xrng[0])
    dy = float(yrng[1] - yrng[0])
    binArray = [ {
        'x': xrng[0] + (dx * i / numBins),
        'y': yrng[0] + (dy * j / numBins),
        'count': k } for i, j, k in hist2Ds ]
    result = {
        'x': { 'delta': dx / numBins, 'extent': xrng, 'name': pair[0], },
        'y': { 'delta': dy / numBins, 'extent': yrng, 'name': pair[1], },
        'bins': binArray,
        'numberOfBins': numBins,
        }
    return result

  # given a list of pairs of names from self.fields, calc and publish 2D histograms
  @exportRpc('divvy.histograms.request')
  def requestHistograms(self, request):
    print(request)
    if 'hist2D' in request:
      for pair in request['hist2D']:
        result = self.get2DHistogram(pair)
        self.publish('divvy.histogram2D.push', { "name": pair, "data": result })
    if 'hist1D' in request:
      for field in request['hist1D']:
        result = self.get1DHistogram(field)
        self.publish('divvy.histogram1D.push', { "name": field, "data": result })

    return { "success": True }
