/* global window, document */
import 'normalize.css';
import 'babel-polyfill';

import Workbench from 'paraviewweb/src/Component/Native/Workbench';
import ToggleControl from 'paraviewweb/src/Component/Native/ToggleControl';
import BGColor from 'paraviewweb/src/Component/Native/BackgroundColor';
import Spacer from 'paraviewweb/src/Component/Native/Spacer';
import Composite from 'paraviewweb/src/Component/Native/Composite';
import ReactAdapter from 'paraviewweb/src/Component/React/ReactAdapter';
import WorkbenchController from 'paraviewweb/src/Component/React/WorkbenchController';

import CompositeClosureHelper from 'paraviewweb/src/Common/Core/CompositeClosureHelper';
import FieldProvider from 'paraviewweb/src/InfoViz/Core/FieldProvider';
import LegendProvider from 'paraviewweb/src/InfoViz/Core/LegendProvider';
import Histogram1DProvider from 'paraviewweb/src/InfoViz/Core/Histogram1DProvider';
import Histogram2DProvider from 'paraviewweb/src/InfoViz/Core/Histogram2DProvider';
import HistogramBinHoverProvider from 'paraviewweb/src/InfoViz/Core/HistogramBinHoverProvider';
// import ScoresProvider from 'paraviewweb/src/InfoViz/Core/ScoresProvider';
import SelectionProvider from 'paraviewweb/src/InfoViz/Core/SelectionProvider';
import MutualInformationProvider from 'paraviewweb/src/InfoViz/Core/MutualInformationProvider';

import HistogramSelector from 'paraviewweb/src/InfoViz/Native/HistogramSelector';
import FieldSelector from 'paraviewweb/src/InfoViz/Native/FieldSelector';
import MutualInformationDiagram from 'paraviewweb/src/InfoViz/Native/MutualInformationDiagram';
import ParallelCoordinates from 'paraviewweb/src/InfoViz/Native/ParallelCoordinates';

import { debounce } from 'paraviewweb/src/Common/Misc/Debounce';

import dataModel from './state.json';

const container = document.querySelector('body');
container.style.height = '100vh';
container.style.width = '100vw';

// const green = new BGColor('green');
// const red = new BGColor('red');
const blue = new BGColor('blue');
// const pink = new BGColor('pink');
// const gray = new BGColor('gray');

// const toggleView = new ToggleControl(green, red);
const provider = CompositeClosureHelper.newInstance((publicAPI, model, initialValues = {}) => {
  Object.assign(model, initialValues);
  FieldProvider.extend(publicAPI, model, initialValues);
  Histogram1DProvider.extend(publicAPI, model, initialValues);
  Histogram2DProvider.extend(publicAPI, model, initialValues);
  HistogramBinHoverProvider.extend(publicAPI, model);
  LegendProvider.extend(publicAPI, model, initialValues);
  // ScoresProvider.extend(publicAPI, model, initialValues);
  SelectionProvider.extend(publicAPI, model, initialValues);
  MutualInformationProvider.extend(publicAPI, model, initialValues);
})(dataModel);

// set provider behaviors
provider.setFieldsSorted(true);
provider.getFieldNames().forEach((name) => {
  provider.addLegendEntry(name);
});
provider.assignLegend(['colors', 'shapes']);
provider.setHistogram2dProvider(provider);

// Create histogram selector
const histogramSelector = HistogramSelector.newInstance({ provider });

const fieldSelector = FieldSelector.newInstance({ provider });

const diag = MutualInformationDiagram.newInstance({ provider });

const parallelCoordinates = ParallelCoordinates.newInstance({ provider });

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
  Blue: {
    component: blue,
    viewport: -1,
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

// Create a debounced window resize handler
const resizeHandler = debounce(() => {
  mainComponent.resize();
}, 50);

// Register window resize handler so workbench redraws when browser is resized
window.onresize = resizeHandler;

