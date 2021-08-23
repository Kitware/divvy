import CompositeClosureHelper from 'paraviewweb/src/Common/Core/CompositeClosureHelper';
import SmartConnect from 'wslink/src/SmartConnect';
import ParaViewWebClient from 'paraviewweb/src/IO/WebSocket/ParaViewWebClient';

function divvyClient(publicAPI, model) {
  // private variables
  let ready = false;
  const readyCallbacks = [];
  const errorCallbacks = [];

  const busy = (promise) => promise;

  function triggerError(sConnect, message = 'Server disconnected') {
    for (let i = 0; i < errorCallbacks.length; i++) {
      errorCallbacks[i](message);
    }
  }

  publicAPI.connect = (userConfig) => {
    const config = Object.assign({ application: 'divvy' }, userConfig);
    const smartConnect = SmartConnect.newInstance({ config });
    smartConnect.onConnectionReady((connection) => {
      model.connection = connection;
      model.pvwClient = ParaViewWebClient.createClient(
        connection,
        ['MouseHandler', 'ViewPort', 'VtkImageDelivery'],
        {
          Divvy: (session) => ({
            getFieldInfo: () => busy(session.call('divvy.fields.get')),
            // getScores: () => busy(session.call('divvy.scores.get')),
            // hasMesh: () => busy(session.call('divvy.scatterplot.mesh')),
            requestHistograms: (request) =>
              busy(session.call('divvy.histograms.request', [request])),
            requestAnnotationHistograms: (request) =>
              busy(
                session.call('divvy.histograms.annotation.request', [request])
              ),
            subscribe1DHistogram: (callback) =>
              session.subscribe('divvy.histogram1D.push', callback),
            subscribe2DHistogram: (callback) =>
              session.subscribe('divvy.histogram2D.push', callback),
            subscribeSelectionCount: (callback) =>
              session.subscribe('divvy.selection.count.push', callback),
            updateAnnotation: (annot) =>
              busy(session.call('divvy.annotation.update', [annot])),
            // scatter plot
            updateScatterPlot: (request) =>
              busy(session.call('divvy.scatterplot.update', [request])),
            getLutImages: () =>
              busy(session.call('divvy.scatterplot.lut.images.get', [])),
            getViews: () => busy(session.call('divvy.scatterplot.views.get')),
            setActiveScores: (activeScores) =>
              busy(
                session.call('divvy.scatterplot.active.scores', [activeScores])
              ),
            updateCamera: (mode) =>
              busy(session.call('divvy.scatterplot.camera.update', [mode])),
            updateAxis: (showMesh = false, force = false) =>
              busy(
                session.call('divvy.scatterplot.axes.update', [showMesh, force])
              ),
          }),
        }
      );
      publicAPI
        .serverAPI()
        .getFieldInfo()
        .then(
          (result) => {
            model.fieldList = result.fields;
            model.scores = result.scores;
            model.numberOfRows = result.numRows;
            model.hasMesh = result.hasMesh;
            ready = true;

            // we have an active connection and client, let everyone know.
            readyCallbacks.forEach((callback) => {
              if (callback) callback();
            });
          },
          (errResult) => {
            ready = false;
            console.error('failed to fetch field list', errResult);
          }
        );
    });
    smartConnect.onConnectionError(triggerError);
    smartConnect.onConnectionClose(triggerError);
    smartConnect.connect();
  };

  publicAPI.exit = (timeout = 60) => {
    if (model.connection) {
      model.connection.destroy(timeout);
      model.connection = null;
    }
  };

  publicAPI.pvwClient = () => model.pvwClient;

  publicAPI.serverAPI = () => model.pvwClient.Divvy;

  publicAPI.onReady = (callback) => {
    if (ready) {
      callback();
      return;
    }
    readyCallbacks.push(callback);
  };

  publicAPI.onError = (callback) => {
    errorCallbacks.push(callback);
  };
}

const DEFAULT_VALUES = {
  fieldList: null,
  pvwClient: null,
  numberOfRows: 42,
};

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  CompositeClosureHelper.get(publicAPI, model, [
    'fieldList',
    'hasMesh',
    'scores',
    'numberOfRows',
  ]);

  divvyClient(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = CompositeClosureHelper.newInstance(extend);

// ----------------------------------------------------------------------------

export default { newInstance, extend };
