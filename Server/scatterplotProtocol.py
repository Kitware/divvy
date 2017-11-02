r"""
    ParaViewWeb protocol to satisfy RPC and publish/subscribe requests from Divvy

"""
from __future__ import absolute_import, division, print_function

import os

# import paraview modules.
from paraview.web.protocols import ParaViewWebProtocol
from paraview import simple, servermanager

# import RPC annotation
from wslink import register as exportRpc

# data, math
import vtk, vtk.util.numpy_support
# from vtk.util.numpy_support import vtk_to_numpy, numpy_to_vtk
from vtkPVServerManagerRenderingPython import vtkSMPVRepresentationProxy

# import numpy as np

USER_SELECTION = "user selection"

# =============================================================================
# Respond to RPC requests about a remote-rendered scatterplot
# =============================================================================
class ScatterPlotProtocol(ParaViewWebProtocol):
  def __init__(self, divvyProtocol):
    super(ScatterPlotProtocol, self).__init__()
    self.divvyProtocol = divvyProtocol
    self.dataTable = None
    self.arrays = {}
    self.renderView = simple.CreateView('RenderView')
    self.renderView.InteractionMode = '3D'

  def resetCamera(self):
    simple.Render(self.renderView)
    simple.ResetCamera(self.renderView)
    self.renderView.CenterOfRotation = self.renderView.CameraFocalPoint

  # make or update a scatter plot
  @exportRpc('divvy.scatterplot.update')
  def updateScatterPlot(self, config):
    updateAxes = False
    if not self.dataTable:
      # initialize everything
      self.dataTable = vtk.vtkTable()
      self.dataTable.ShallowCopy(self.divvyProtocol.getData())

      # copy data from the main protocol, and set up pipelilne
      trivProducer = simple.TrivialProducer()
      trivProducer.GetClientSideObject().SetOutput(self.dataTable)

      self.tableToPoints = simple.TableToPoints(Input=trivProducer)
      self.tableToPoints.XColumn = config['x']
      self.tableToPoints.YColumn = config['y']
      self.tableToPoints.ZColumn = config['z']
      self.tableToPoints.KeepAllDataArrays = 1

      self.tableToPoints.UpdatePipeline()

      self.arrays['x'] = config['x']
      self.arrays['y'] = config['y']
      self.arrays['z'] = config['z']

      self.representation = simple.GetRepresentation(self.tableToPoints, self.renderView)
      self.representation.Representation = 'Surface'
      self.representation.PointSize = 5
      self.representation.Opacity = 1.0

      self.representation.Visibility = 1


      self.renderView.AxesGrid = 'GridAxes3DActor'
      self.renderView.AxesGrid.Visibility = 1
      self.renderView.AxesGrid.XTitleColor = [0.0, 0.0, 0.0]
      self.renderView.AxesGrid.YTitleColor = [0.0, 0.0, 0.0]
      self.renderView.AxesGrid.ZTitleColor = [0.0, 0.0, 0.0]
      self.renderView.AxesGrid.GridColor = [0.0, 0.0, 0.0]
      self.renderView.AxesGrid.ShowGrid = 1
      self.renderView.AxesGrid.XLabelColor = [0.0, 0.0, 0.0]
      self.renderView.AxesGrid.YLabelColor = [0.0, 0.0, 0.0]
      self.renderView.AxesGrid.ZLabelColor = [0.0, 0.0, 0.0]
      self.renderView.AxesGrid.DataScale = [ 1, 1, 1 ]

      self.renderView.OrientationAxesVisibility = 0
      self.renderView.Background = [1.0, 1.0, 1.0]

      # create a LUT, if needed
      if 'colorBy' in config:
        vtkSMPVRepresentationProxy.SetScalarColoring(self.representation.SMProxy, config['colorBy'], 0)
        vtkSMPVRepresentationProxy.RescaleTransferFunctionToDataRange(self.representation.SMProxy, config['colorBy'], 0, False, True)

      updateAxes = True

    else:
      # update
      if self.arrays['x'] != config['x'] or \
        self.arrays['y'] != config['y'] or \
        self.arrays['z'] != config['z']:

        self.tableToPoints.XColumn = config['x']
        self.tableToPoints.YColumn = config['y']
        self.tableToPoints.ZColumn = config['z']

        self.arrays['x'] = config['x']
        self.arrays['y'] = config['y']
        self.arrays['z'] = config['z']

        self.renderView.AxesGrid.XTitle = config['x']
        self.renderView.AxesGrid.YTitle = config['y']
        self.renderView.AxesGrid.ZTitle = config['z']
        self.dataTable.Modified()
        updateAxes = True

    if updateAxes:
      self.updateAxis()

    return { 'success': True }

  @exportRpc('divvy.scatterplot.lut.images.get')
  def getLutImages(self):
    return { 'success': True }

  @exportRpc('divvy.scatterplot.camera.update')
  def updateCamera(self, mode):
    view = self.renderView

    if mode == 'X':
      view.CameraPosition = [0.0, 0.0, 0.0]
      view.CameraFocalPoint = [1.0, 0.0, 0.0]
      view.CameraViewUp = [0.0, 1.0, 0.0]
    elif mode == 'Y':
      view.CameraPosition = [0.0, 0.0, 0.0]
      view.CameraFocalPoint = [0.0, 1.0, 0.0]
      view.CameraViewUp = [0.0, 0.0, 1.0]
    elif mode == 'Z':
      view.CameraPosition = [0.0, 0.0, 0.0]
      view.CameraFocalPoint = [0.0, 0.0, 1.0]
      view.CameraViewUp = [1.0, 0.0, 0.0]
    elif mode == '2D':
      view.InteractionMode = '2D'
    elif mode == '3D':
      view.InteractionMode = '3D'

    self.resetCamera()
    return { 'success': True }

  @exportRpc('divvy.scatterplot.axes.update')
  def updateAxis(self):
    # rescale via the representation
    scaleBounds = self.tableToPoints.GetClientSideObject().GetOutputDataObject(0).GetBounds()
    scale = self.representation.Scale
    lastScale = scale[:]

    # don't rescale empty ranges, where min == max
    for i in range(3):
      if scaleBounds[i*2 + 1] != scaleBounds[i*2]:
        scale[i] = 100.0 / (scaleBounds[i*2 + 1] - scaleBounds[i*2])
    self.representation.Scale = scale

    self.renderView.AxesGrid.DataScale = [ scale[0], scale[1], scale[2] ]

    # Transfer function may need rescaling.
    colorArray = vtkSMPVRepresentationProxy.GetArrayInformationForColorArray(self.representation.SMProxy).GetName()
    if colorArray != USER_SELECTION:
      vtkSMPVRepresentationProxy.RescaleTransferFunctionToDataRange(self.representation.SMProxy, colorArray, 0, False, True)

    # reset the camera iff the scale changed.
    if scale != lastScale:
      self.resetCamera()
    return { 'success': True }

  @exportRpc('divvy.scatterplot.views.get')
  def getViews(self):
    return {
      "scatter-plot": self.renderView.GetGlobalIDAsString()
    }
