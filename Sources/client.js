/* global window, document */
import 'babel-polyfill';

import CompositeClosureHelper from 'paraviewweb/src/Common/Core/CompositeClosureHelper';
import SmartConnect from 'wslink/src/SmartConnect';
import ParaViewWebClient from 'paraviewweb/src/IO/WebSocket/ParaViewWebClient';


function divvyClient(publicAPI, model) {
  // private variables
  let ready = false;
  const readyCallbacks = [];

  publicAPI.connect = () => {
    const config = { sessionURL: `ws://localhost:${model.port}/ws` };
    const smartConnect = SmartConnect.newInstance({ config });
    smartConnect.onConnectionReady((connection) => {
      model.pvwClient = ParaViewWebClient.createClient(
        connection,
        ['MouseHandler', 'ViewPort', 'ViewPortImageDelivery'],
        {
          Divvy: session =>
            ({
              getFields: () => session.call('divvy.fields.get'),
              requestHistograms: request => session.call('divvy.histograms.request', [request]),
              subscribe1DHistogram: callback => session.subscribe('divvy.histogram1D.push', callback),
              subscribe2DHistogram: callback => session.subscribe('divvy.histogram2D.push', callback),
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
  port: 1234,
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
