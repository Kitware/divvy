/* global window, document */
import 'normalize.css';

import Workbench from 'paraviewweb/src/Component/Native/Workbench';
import ToggleControl from 'paraviewweb/src/Component/Native/ToggleControl';
import BGColor from 'paraviewweb/src/Component/Native/BackgroundColor';
import Spacer from 'paraviewweb/src/Component/Native/Spacer';
import Composite from 'paraviewweb/src/Component/Native/Composite';
import ReactAdapter from 'paraviewweb/src/Component/React/ReactAdapter';
import WorkbenchController from 'paraviewweb/src/Component/React/WorkbenchController';

import { debounce } from 'paraviewweb/src/Common/Misc/Debounce';


const container = document.querySelector('.content');
container.style.height = '100vh';
container.style.width = '100vw';

const green = new BGColor('green');
const red = new BGColor('red');
const blue = new BGColor('blue');
const pink = new BGColor('pink');
const gray = new BGColor('gray');

// const toggleView = new ToggleControl(green, red);

const viewports = {
  Gray: {
    component: gray,
    viewport: 2,
  },
  // ToggleView: {
  //   component: toggleView,
  //   viewport: 0,
  // },
  Green: {
    component: green,
    viewport: 0,
  },
  Red: {
    component: red,
    viewport: -1,
  },
  Blue: {
    component: blue,
    viewport: 1,
  },
  Pink: {
    component: pink,
    viewport: 3,
  },
};

const workbench = new Workbench();
workbench.setComponents(viewports);
workbench.setLayout('2x2');

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
  console.log(component ? component.color : 'none', index, count,
              index === -1 || index >= count ? 'hidden' : 'visible');
});

// Create a debounced window resize handler
const resizeHandler = debounce(() => {
  mainComponent.resize();
}, 50);

// Register window resize handler so workbench redraws when browser is resized
window.onresize = resizeHandler;

