import RemoteRenderStatsTable from 'paraviewweb/src/NativeUI/Renderers/RemoteRendererStatsTable';
import RemoteRenderer from 'paraviewweb/src/NativeUI/Canvas/RemoteRenderer';

export default class ScatterPlotManager {
  constructor(provider) {
    this.dataProvider = provider;
    this.projection = '3D';
    this.model = null;
    this.client = null;
    this.viewId = null;
    this.remoteRenderers = {};
    this.readyCallbacks = [];
    this.subscriptions = [];
    this.colorMaps = null;

    // Force a redraw and server for scatterplot processing
    if (provider.onAnnotationChange) {
      this.subscriptions.push(this.dataProvider.onAnnotationChange(() => {
        this.updateRenderers();
      }));
    }

    if (provider.onFieldChange) {
      this.subscriptions.push(this.dataProvider.onFieldChange((field) => {
        this.model.arrayList = this.dataProvider.getFieldNames();

        if (!field) {
          // One or all fields removed
          this.checkRemovedFields();
        }

        this.updateRenderers();
      }));
    }

    if (provider.onScatterPlotUpdate) {
      this.subscriptions.push(this.dataProvider.onScatterPlotUpdate(() => {
        this.updateRenderers();
      }));
    }

    // Get fields to choose from
    let names = provider.getActiveFieldNames();
    if (names.length < 4) {
      names = provider.getFieldNames();
    }

    this.model = {
      arrayList: names,
      x: names[0 % names.length],
      y: names[1 % names.length],
      z: names[2 % names.length],
      colorBy: names[3 % names.length],
      colorMapName: 'HighestBest',
      usePointSprites: false,
      constantPointSize: '2',
      pointSize: '3',
      pointSizeBy: '',
      pointRepresentation: 'Black-edged circle',
      pointSizeMin: '1',
      pointSizeMax: '3',
      pointSizeFunction: 'HighestBest',
      opacityBy: '',
      opacityFunction: 'HighestBest',
      showRenderStats: false,
    };

    // Get remote view information
    this.client = provider.getClient();
    this.client.serverAPI().getViews()
      .then(
        (views) => {
          this.viewId = Number(views['scatter-plot']);

          this.client.serverAPI().getLutImages()
            .then(
              (lutImages) => {
                this.colorMaps = lutImages;

                // Don't push the initial configuration, avoids unnecessary render.
                // this.updateModel(this.model);

                while (this.readyCallbacks.length) {
                  this.readyCallbacks.pop()();
                }
              },
              (erp) => {
                console.log('failed to get lut images: ', erp);
              },
            );
        },
        (err) => {
          console.log('Error', err);
        },
      );
  }

  updateRenderers() {
    const visibleRenderers = [];
    Object.keys(this.remoteRenderers).forEach((rendererKey) => {
      if (this.remoteRenderers[rendererKey].container) {
        visibleRenderers.push(rendererKey);
      }
    });
    visibleRenderers.forEach((key) => {
      this.updateModel(this.model, key);
    });
  }

  getProvider() {
    return this.dataProvider;
  }

  // getClient() {
  //   return this.client;
  // }

  getColorMaps() {
    return this.colorMaps;
  }

  createRemoteRenderer(id) {
    this.remoteRenderers[id] = new RemoteRenderer(this.client.pvwClient(), null, this.viewId, new RemoteRenderStatsTable());
    return this.remoteRenderers[id];
  }

  getRemoteRenderer(id) {
    return this.remoteRenderers[id];
  }

  getModel() {
    return this.model;
  }

  checkRemovedFields() {
    const fieldNames = this.dataProvider.getFieldNames();

    const usingFields = {
      x: this.model.x,
      y: this.model.y,
      z: this.model.z,
      colorBy: this.model.colorBy,
      pointSizeBy: this.model.pointSizeBy,
      opacityBy: this.model.opacityBy,
    };

    let fidx = 0;
    Object.keys(usingFields).forEach((usingFieldKey) => {
      const arrayName = usingFields[usingFieldKey];
      if (arrayName && fieldNames.indexOf(arrayName) < 0) {
        this.model[usingFieldKey] = fieldNames[fidx];
        fidx += 1;
      }
    });
  }

  updateModel(model, id) {
    this.model = model;

    const sizeOptions = {
      pointSize: Number(model.pointSize),
    };

    if (model.pointSizeBy) {
      sizeOptions.array = model.pointSizeBy;
      sizeOptions.range = [Number(model.pointSizeMin), Number(model.pointSizeMax)];
      sizeOptions.scalarRange = this.getScalarRange(model.pointSizeBy);
      sizeOptions.scaleFunction = model.pointSizeFunction;
    } else {
      sizeOptions.constantSize = Number(model.constantPointSize);
    }

    return new Promise((a, r) => {
      this.client.serverAPI().updateScatterPlot(model)
      //   [
      //   model.x,
      //   model.y,
      //   model.z,
      //   { // Color
      //     array: model.colorBy,
      //     colorMap: model.colorMapName,
      //   },
      //   model.usePointSprites,
      //   sizeOptions,
      //   { // Opacity
      //     array: model.opacityBy,
      //     scalarRange: this.getScalarRange(model.opacityBy),
      //     opacityFunction: model.opacityFunction,
      //   },
      //   model.pointRepresentation,
      //   model.showRenderStats,
      // ])
        .then(
          (resp) => {
            this.resetCamera(id);
            a(resp);
          },
          (err) => {
            console.log(err);
            r(err);
          },
        );
    });
  }

  resetCamera(id) {
    this.client.serverAPI().updateAxis()
      .then(
        (resp) => {
          if (id && this.remoteRenderers[id]) {
            this.remoteRenderers[id].showRenderStats(this.model.showRenderStats);
            this.remoteRenderers[id].render();
          } else {
            Object.keys(this.remoteRenderers).forEach((name) => {
              this.remoteRenderers[name].showRenderStats(this.model.showRenderStats);
              this.remoteRenderers[name].render();
            });
          }
        },
        (err) => {
          console.log('Error reset camera', err);
        },
      );
  }

  updateProjection(mode = '3D', id) {
    if (['2D', '3D'].indexOf(mode) !== -1) {
      this.projection = mode;
    }
    this.client.serverAPI().updateCamera(mode).then(
      (resp) => {
        if (id && this.remoteRenderers[id]) {
          this.remoteRenderers[id].render();
        } else {
          Object.keys(this.remoteRenderers).forEach((name) => {
            this.remoteRenderers[name].render();
          });
        }
      },
      (err) => {
        console.log('Error updateProjection', err);
      },
    );
  }

  getScalarRange(arrayName) {
    const selectedArray = this.dataProvider.getField(arrayName);
    if (selectedArray && selectedArray.range) {
      return selectedArray.range;
    }
    return [0, 1];
  }

  getProjection() {
    return this.projection;
  }

  destroy() {
    while (this.subscriptions.length) {
      this.subscriptions.pop().unsubscribe();
    }
    if (this.remoteRenderers) {
      Object.keys(this.remoteRenderers).forEach((id) => {
        this.remoteRenderers[id].destroy();
        delete this.remoteRenderers[id];
      });
    }
    this.client = null;
    this.dataProvider = null;
  }

  onReady(callback) {
    if (this.viewId) {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }
}
