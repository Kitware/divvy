r"""
    This module is a ParaViewWeb server application.
    The following command line illustrates how to use it::

        $ pvpython -dr .../pvw-divvy.py --data /.../path-to-your-data-file

        --data
             Path used to load the data file

    Any ParaViewWeb executable script comes with a set of standard arguments that can be overriden if need be::

        --port 8080
             Port number on which the HTTP server will listen.

        --content /path-to-web-content/
             Directory that you want to serve as static web content.
             By default, this variable is empty which means that we rely on another
             server to deliver the static content and the current process only
             focuses on the WebSocket connectivity of clients.

        --authKey vtkweb-secret
             Secret key that should be provided by the client to allow it to make
             any WebSocket communication. The client will assume if none is given
             that the server expects "vtkweb-secret" as secret key.

"""
from __future__ import absolute_import, division, print_function

# import to process args
import os

# import paraview modules.
from paraview.web import pv_wslink
from paraview.web import protocols as pv_protocols
from divvyProtocol import DivvyProtocol
from scatterplotProtocol import ScatterPlotProtocol

from paraview import simple
from wslink import server

import vtk

import argparse

# =============================================================================
# Create custom PVServerProtocol class to handle clients requests
# =============================================================================

class _DivvyServer(pv_wslink.PVServerProtocol):
    authKey = "wslink-secret"
    fileToLoad = None

    @staticmethod
    def add_arguments(parser):
        parser.add_argument("--data", default=None, help="path to data file to load", dest="fileToLoad")

    @staticmethod
    def configure(args):
        _DivvyServer.fileToLoad = args.fileToLoad

    def initialize(self):
        # Bring used components
        self.registerVtkWebProtocol(pv_protocols.ParaViewWebMouseHandler())
        self.registerVtkWebProtocol(pv_protocols.ParaViewWebViewPort())
        self.registerVtkWebProtocol(pv_protocols.ParaViewWebViewPortImageDelivery())

        colorManager = pv_protocols.ParaViewWebColorManager()
        self.registerVtkWebProtocol(colorManager)

        dataProtocol = DivvyProtocol(_DivvyServer.fileToLoad)
        self.registerVtkWebProtocol(dataProtocol)
        scatterplot = ScatterPlotProtocol(dataProtocol, colorManager)
        self.registerVtkWebProtocol(scatterplot)
        dataProtocol.setScatterPlot(scatterplot)

        self.updateSecret(_DivvyServer.authKey)

# =============================================================================
# Main: Parse args and start server
# =============================================================================

if __name__ == "__main__":
    # Create argument parser
    parser = argparse.ArgumentParser(description="Divvy, your data analytic with ParaView")

    # Add default arguments
    server.add_arguments(parser)
    _DivvyServer.add_arguments(parser)
    args = parser.parse_args()
    _DivvyServer.configure(args)

    # Start server
    server.start_webserver(options=args, protocol=_DivvyServer)
