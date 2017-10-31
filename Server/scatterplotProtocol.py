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

  # make or update a scatter plot
  @exportRpc('divvy.scatterplot.update')
  def updateScatterPlot(self, config):
    if not self.dataTable:
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

      # rescale the repr
      xBounds = self.dataTable.GetColumnByName(self.arrays['x']).GetRange()
      yBounds = self.dataTable.GetColumnByName(self.arrays['y']).GetRange()
      zBounds = self.dataTable.GetColumnByName(self.arrays['z']).GetRange()
      scaleBounds = [xBounds[0], xBounds[1], yBounds[0], yBounds[1], zBounds[0], zBounds[1]]
      scale = self.representation.Scale
      # Only set the scale on an axis if max != min on the axis
      for i in range(3):
          if scaleBounds[i*2 + 1] != scaleBounds[i*2]:
              scale[i] = 100.0 / (scaleBounds[i*2 + 1] - scaleBounds[i*2])
      self.representation.Scale = scale

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
      self.renderView.AxesGrid.DataScale = [ scale[0], scale[1], scale[2] ]

      self.renderView.OrientationAxesVisibility = 0
      self.renderView.Background = [1.0, 1.0, 1.0]

      simple.Render(self.renderView)
      simple.ResetCamera(self.renderView)
      self.renderView.CenterOfRotation = self.renderView.CameraFocalPoint

      # create a LUT, if needed
      if 'colorBy' in config:
        vtkSMPVRepresentationProxy.SetScalarColoring(self.representation.SMProxy, config['colorBy'], 0)
        vtkSMPVRepresentationProxy.RescaleTransferFunctionToDataRange(self.representation.SMProxy, config['colorBy'], 0, False, True)

    else:
      pass

    return { 'success': True }
