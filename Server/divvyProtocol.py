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
import vtk #, vtk.util.numpy_support
# from vtk.util.numpy_support import vtk_to_numpy, numpy_to_vtk
# import numpy as np

# =============================================================================
#
# =============================================================================
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

class DivvyProtocol(ParaViewWebProtocol):
  def __init__(self):
    super(DivvyProtocol, self).__init__()
    self.dataTable = None

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

  @exportRpc('divvy.histograms.request')
  def requestHistograms(self, request):
    print(request)
    return { "foo": "bar" }
