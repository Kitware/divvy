/* global window, document */
import 'normalize.css';
import 'babel-polyfill';

import AnnotationEditorWidget from 'paraviewweb/src/React/Widgets/AnnotationEditorWidget';
import Composite from 'paraviewweb/src/Component/Native/Composite';
import FieldSelector from 'paraviewweb/src/InfoViz/Native/FieldSelector';
import HistogramSelector from 'paraviewweb/src/InfoViz/Native/HistogramSelector';
import MutualInformationDiagram from 'paraviewweb/src/InfoViz/Native/MutualInformationDiagram';
import ParallelCoordinates from 'paraviewweb/src/InfoViz/Native/ParallelCoordinates';
import ReactAdapter from 'paraviewweb/src/Component/React/ReactAdapter';
import SizeHelper from 'paraviewweb/src/Common/Misc/SizeHelper';
import Spacer from 'paraviewweb/src/Component/Native/Spacer';
import ToggleControl from 'paraviewweb/src/Component/Native/ToggleControl';
import Workbench from 'paraviewweb/src/Component/Native/Workbench';
import WorkbenchController from 'paraviewweb/src/Component/React/WorkbenchController';

// import dataModel from './state.json';

import DivvyProvider from './provider';
import DivvyClient from './client';

const container = document.querySelector('body');
container.style.height = '100vh';
container.style.width = '100vw';

const client = DivvyClient.newInstance();
// dataModel.client = client;
const provider = DivvyProvider.newInstance({ client });

// don't lay out the initial controls until field list is back.
client.onReady(() => {
  // Create viz components
  const histogramSelector = HistogramSelector.newInstance({ provider });

  const fieldSelector = FieldSelector.newInstance({ provider });

  const diag = MutualInformationDiagram.newInstance({ provider });

  const parallelCoordinates = ParallelCoordinates.newInstance({ provider });
  parallelCoordinates.propagateAnnotationInsteadOfSelection(true, 0, 1);

  const annotationWidgetProps = {
    annotation: null,
    scores: provider.getScores(),
    ranges: provider.getFieldNames().reduce((ranges, field) => {
      // Dict: key is field name, value is the field's range [min, max]
      ranges[field] = provider.getField(field).range;
      return ranges;
    }, {}),
    onChange: (annot, editDone) => {
      annotationWidgetProps.annotation = annot;
      // eslint-disable-next-line no-use-before-define
      annotEditor.render();
      if (editDone) provider.setAnnotation(annot);
    },
    getLegend: provider.getLegend,
    scroll: true,
  };
  const annotEditor = new ReactAdapter(AnnotationEditorWidget, annotationWidgetProps);


  const viewports = {
    Fields: {
      component: fieldSelector,
      viewport: 2,
      scroll: true,
    },
    Histograms: {
      component: histogramSelector,
      viewport: 0,
    },
    'Mutual Information': {
      component: diag,
      viewport: 1,
    },
    'Parallel Coordinates': {
      component: parallelCoordinates,
      viewport: 3,
    },
    'Annotation Editor': {
      component: annotEditor,
      viewport: -1,
      scroll: true,
    },
  };

  const workbench = new Workbench();
  workbench.setComponents(viewports);
  workbench.setLayout('2x2');

  // set a target number per row.
  // histogramSelector.requestNumBoxesPerRow(4);

  const props = {
    onLayoutChange(layout) {
      workbench.setLayout(layout);
    },
    onViewportChange(index, instance) {
      workbench.setViewport(index, instance);
    },
    activeLayout: workbench.getLayout(),
    viewports: workbench.getViewportMapping(),
    count: 4,
  };

  const controlPanel = new ReactAdapter(WorkbenchController, props);
  const shiftedWorkbench = new Composite();
  shiftedWorkbench.addViewport(new Spacer(), false);
  shiftedWorkbench.addViewport(workbench);
  const mainComponent = new ToggleControl(shiftedWorkbench, controlPanel, 280);
  mainComponent.setContainer(container);

  workbench.onChange((model) => {
    props.activeLayout = model.layout;
    props.viewports = model.viewports;
    props.count = model.count;
    controlPanel.render();
  });

  workbench.onVisibilityChange((event) => {
    const { component, index, count } = event;
    console.log(
      component ? component.color : 'none', index, count,
      index === -1 || index >= count ? 'hidden' : 'visible',
    );
  });

  // make sure annot editor hears about annot changes
  provider.onAnnotationChange((annot) => {
    annotationWidgetProps.annotation = annot;
    annotEditor.render();
  });

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

export function connect(userConfig) {
  client.connect(userConfig);
}

export function autoStopServer(timeout = 60) {
  function exitOnClose() {
    client.exit(timeout);
  }
  window.addEventListener('unload', exitOnClose);
  window.addEventListener('beforeunload', exitOnClose);
}
