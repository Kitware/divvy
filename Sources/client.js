/* global window, document */
import 'babel-polyfill';

import CompositeClosureHelper from 'paraviewweb/src/Common/Core/CompositeClosureHelper';
import SmartConnect from 'wslink/src/SmartConnect';
import ParaViewWebClient from 'paraviewweb/src/IO/WebSocket/ParaViewWebClient';

function divvyClient(publicAPI, model) {
  // private variables
  let ready = false;
  const readyCallbacks = [];

  const busy = promise => promise;

  publicAPI.connect = (userConfig) => {
    const config = Object.assign({ application: 'divvy' }, userConfig);
    const smartConnect = SmartConnect.newInstance({ config });
    smartConnect.onConnectionReady((connection) => {
      model.connection = connection;
      model.pvwClient = ParaViewWebClient.createClient(
        connection,
        ['MouseHandler', 'ViewPort', 'ViewPortImageDelivery'],
        {
          Divvy: session =>
            ({
              getFields: () => session.call('divvy.fields.get'),
              requestHistograms: request => session.call('divvy.histograms.request', [request]),
              requestAnnotationHistograms: request => session.call('divvy.histograms.annotation.request', [request]),
              subscribe1DHistogram: callback => session.subscribe('divvy.histogram1D.push', callback),
              subscribe2DHistogram: callback => session.subscribe('divvy.histogram2D.push', callback),
              updateAnnotation: annot => session.call('divvy.annotation.update', [annot]),
              // scatter plot
              updateScatterPlot: request => session.call('divvy.scatterplot.update', [request]),
              // updateScatterPlot: params => busy(session.call('erdc.ers.viz.update.scatter.plot', [...params])),
              getLutImages: () => busy(session.call('divvy.scatterplot.lut.images.get', [])),
              updateCamera: mode => busy(session.call('divvy.scatterplot.camera.update', [mode])),
              updateAxis: () => busy(session.call('divvy.scatterplot.axes.update', [])),
              getViews: () => busy(session.call('divvy.scatterplot.views.get')),
            }),
        },
      );
      publicAPI.serverAPI().getFields().then((result) => {
        model.fieldList = result;

        ready = true;
        // we have an active connection and client, let everyone know.
        readyCallbacks.forEach((callback) => { if (callback) callback(); });
      }, (errResult) => {
        ready = false;
        console.error('failed to fetch field list', errResult);
      });
    });
    smartConnect.connect();
  };

  publicAPI.exit = (timeout = 60) => {
    if (model.connection) {
      model.connection.destroy(timeout);
      model.connection = null;
    }
  };

  publicAPI.pvwClient = () => (model.pvwClient);

  publicAPI.serverAPI = () => (model.pvwClient.Divvy);

  publicAPI.onReady = (callback) => {
    if (ready) {
      callback();
      return;
    }
    readyCallbacks.push(callback);
  };
}

const DEFAULT_VALUES = {
  fieldList: null,
  pvwClient: null,
};

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  CompositeClosureHelper.get(publicAPI, model, ['fieldList']);

  divvyClient(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = CompositeClosureHelper.newInstance(extend);

// ----------------------------------------------------------------------------

export default { newInstance, extend };
