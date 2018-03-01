/* global window, document */
import 'normalize.css';
import 'babel-polyfill';

import React from 'react';
import ReactDOM from 'react-dom';

import URLExtract from 'paraviewweb/src/Common/Misc/URLExtract';
import SizeHelper from 'paraviewweb/src/Common/Misc/SizeHelper';
import ProgressLoaderWidget from 'paraviewweb/src/React/Widgets/ProgressLoaderWidget';
import WorkbenchReact from './workbenchReact';

import DivvyProvider from './provider';
import DivvyClient from './client';
import ScatterPlotManager from './scatterPlotManager';

const container = document.querySelector('.content');
container.style.height = '100vh';
container.style.width = '100vw';

const client = DivvyClient.newInstance();
// dataModel.client = client;
const provider = DivvyProvider.newInstance({ client });

function loading(message = 'Loading ParaView...') {
  ReactDOM.unmountComponentAtNode(container);
  ReactDOM.render(<ProgressLoaderWidget message={message} />, container);
}

client.onError(loading);

// don't lay out the initial controls until field list is back.
client.onReady(() => {
  const scatterPlotManager = new ScatterPlotManager(provider);
  provider.setScatterPlotManager(scatterPlotManager);

  // eslint-disable-next-line react/no-render-return-value
  const mainComponent = ReactDOM.render(
    React.createElement(WorkbenchReact, { provider, client }),
    container
  );

  // Listen to window resize
  SizeHelper.onSizeChange(() => {
    mainComponent.resize();
  });
  SizeHelper.startListening();

  SizeHelper.triggerChange();
});

// ----------------------------------------------------------------------------
// Exposed API
// ----------------------------------------------------------------------------

export function connect(userConfig, useArgsFromURL = false) {
  loading();
  const config = {};
  if (useArgsFromURL) {
    Object.assign(config, URLExtract.extractURLParameters());
  }
  Object.assign(config, userConfig);
  client.connect(config);
}

export function autoStopServer(timeout = 60) {
  function exitOnClose() {
    client.exit(timeout);
  }
  window.addEventListener('unload', exitOnClose);
  window.addEventListener('beforeunload', exitOnClose);
}
