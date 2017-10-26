r"""
    This module is a ParaViewWeb server application.
    The following command line illustrates how to use it::

        $ pvpython -dr .../pvw-divvy.py --data /.../path-to-your-data-directory

        --data
             Path used to list that directory on the server and let the client choose a
             file to load.  You may also specify multiple directories, each with a name
             that should be displayed as the top-level name of the directory in the UI.
             If this parameter takes the form: "name1=path1|name2=path2|...",
             then we will treat this as the case where multiple data directories are
             required.  In this case, each top-level directory will be given the name
             associated with the directory in the argument.

        --load-file try to load the file relative to data-dir if any.

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

from paraview import simple
from wslink import server

import vtk

import argparse

# =============================================================================
# Create custom PVServerProtocol class to handle clients requests
# =============================================================================

class _DivvyServer(pv_wslink.PVServerProtocol):
    dataDir = os.getcwd()
    authKey = "wslink-secret"
    fileToLoad = None

    @staticmethod
    def add_arguments(parser):
        parser.add_argument("--data", default=os.getcwd(), help="path to data directory to list, or else multiple directories given as 'name1=path1|name2=path2|...'", dest="path")
        parser.add_argument("--load-file", default=None, help="File to load if any based on data-dir base path", dest="file")

    @staticmethod
    def configure(args):
        _DivvyServer.authKey           = args.authKey
        _DivvyServer.dataDir           = args.path

        if args.file:
            _DivvyServer.fileToLoad  = os.path.join(args.path, args.file)

    def initialize(self):
        # Bring used components
        self.registerVtkWebProtocol(pv_protocols.ParaViewWebFileListing(_DivvyServer.dataDir, "Home"))
        self.registerVtkWebProtocol(DivvyProtocol(_DivvyServer.fileToLoad))
        # self.registerVtkWebProtocol(pv_protocols.ParaViewWebMouseHandler())
        # self.registerVtkWebProtocol(pv_protocols.ParaViewWebViewPort())
        # self.registerVtkWebProtocol(pv_protocols.ParaViewWebViewPortImageDelivery())
        self.updateSecret(_DivvyServer.authKey)

        # # Disable interactor-based render calls
        # simple.GetRenderView().EnableRenderOnInteraction = 0
        # simple.GetRenderView().Background = [0,0,0]
        # cone = simple.Cone()
        # simple.Show(cone)
        # simple.Render()

        # # Update interaction mode
        # pxm = simple.servermanager.ProxyManager()
        # interactionProxy = pxm.GetProxy('settings', 'RenderViewInteractionSettings')
        # interactionProxy.Camera3DManipulators = ['Rotate', 'Pan', 'Zoom', 'Pan', 'Roll', 'Pan', 'Zoom', 'Rotate', 'Zoom']


# =============================================================================
# Main: Parse args and start server
# =============================================================================

if __name__ == "__main__":
    # Create argument parser
    parser = argparse.ArgumentParser(description="ParaViewWeb Demo")

    # Add default arguments
    server.add_arguments(parser)
    _DivvyServer.add_arguments(parser)
    args = parser.parse_args()
    _DivvyServer.configure(args)

    # Start server
    server.start_webserver(options=args, protocol=_DivvyServer)
