/* global window, document */
import React from 'react';

import Workbench from 'paraviewweb/src/Component/Native/Workbench';
import ReactAdapter from 'paraviewweb/src/Component/React/ReactAdapter';
import ComponentToReact from 'paraviewweb/src/Component/React/ComponentToReact';
// import WorkbenchController from 'paraviewweb/src/Component/React/WorkbenchController';

// import CompositeClosureHelper from 'paraviewweb/src/Common/Core/CompositeClosureHelper';

import HistogramSelector from 'paraviewweb/src/InfoViz/Native/HistogramSelector';
import FieldSelector from 'paraviewweb/src/InfoViz/Native/FieldSelector';
import MutualInformationDiagram from 'paraviewweb/src/InfoViz/Native/MutualInformationDiagram';
import ParallelCoordinates from 'paraviewweb/src/InfoViz/Native/ParallelCoordinates';
// import RemoteRenderer from 'paraviewweb/src/NativeUI/Canvas/RemoteRenderer';

import AnnotationEditorWidget from 'paraviewweb/src/React/Widgets/AnnotationEditorWidget';

import BusyFeedback from 'paraviewweb/src/React/Widgets/BusyFeedback';
import AnnotationEditorToggleTool from 'paraviewweb/src/React/ToggleTools/AnnotationEditor';
import FieldSelectorToggleTool from 'paraviewweb/src/React/ToggleTools/FieldSelector';
import WorkbenchLayoutToggleTool from 'paraviewweb/src/React/ToggleTools/WorkbenchLayout';
import ScatterPlotControlToggleTool from 'paraviewweb/src/React/ToggleTools/ScatterPlotControl';
import ScatterPlotCameraControl from 'paraviewweb/src/React/Widgets/ScatterPlotCameraControl';

import style from './WorkbenchReact.mcss';

export default class WorkbenchReact extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      scatterPlotVisible: false,
    };

    this.onActiveWindow = this.onActiveWindow.bind(this);
    this.resize = this.resize.bind(this);
  }

  componentWillMount() {
    this.subscriptions = [];

    const { provider } = this.props;
    // Create viz components
    const histogramSelector = HistogramSelector.newInstance({ provider });

    const fieldSelector = FieldSelector.newInstance({ provider });

    const diag = MutualInformationDiagram.newInstance({ provider });
    diag.propagateAnnotationInsteadOfSelection(true, 0, 1);

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

    this.workbench = new Workbench();
    this.workbench.setComponents(viewports);
    this.workbench.setLayout('2x2');

    // Setup manager, singleton shared by all scatter plot views.
    this.manager = this.props.provider.getScatterPlotManager();
    this.manager.onReady(() => {
      viewports['3D Scatterplot'] = {
        component: this.manager.createRemoteRenderer('workbench-scatterplot'),
        viewport: -1,
        scroll: false,
      };
      this.workbench.setComponents(viewports);
      this.forceUpdate();
    });

    this.subscriptions.push(this.workbench.onChange((event) => {
      const newScatterPlotVisible = (event.viewports['3D Scatterplot'].viewport < event.count
          && event.viewports['3D Scatterplot'].viewport > -1);
      if (newScatterPlotVisible && !this.state.scatterPlotVisible) {
        // popup scatterplot controls whenever scatterplot is newly shown.
        // if (this.scatterPlotControl) this.scatterPlotControl.setState({ overlayVisible: true });
      }
      this.setState({
        scatterPlotVisible: newScatterPlotVisible,
      });
    }));

    this.subscriptions.push(this.workbench.onVisibilityChange((event) => {
      const { component, index, count } = event;
      console.log(
        component ? component.color : 'none', index, count,
        index === -1 || index >= count ? 'hidden' : 'visible',
      );
      if (index !== -1 && component === this.manager.getRemoteRenderer('workbench-scatterplot')) {
        // Tell scatterplot to update before first render.
        let names = provider.getActiveFieldNames();
        if (names.length < 4) {
          names = provider.getFieldNames();
        }
        const config = {
          x: names[0 % names.length],
          y: names[1 % names.length],
          z: names[2 % names.length],
          colorBy: names[3 % names.length],
        };
        provider.updateScatterPlot(config);
      }
    }));

    // make sure annot editor hears about annot changes
    provider.onAnnotationChange((annot) => {
      annotationWidgetProps.annotation = annot;
      annotEditor.render();
    });
  }
  componentWillUnmount() {
    while (this.subscriptions.length) {
      this.subscriptions.pop().unsubscribe();
    }
    // Object.keys(this.components).forEach((name) => {
    //   this.components[name].destroy();
    //   delete this.components[name];
    // });
  }

  onActiveWindow(activeWindow) {
    this.setState({ activeWindow });
  }

  resize() {
    if (this.workbench) {
      this.workbench.resize();
    }
  }
  render() {
    return (
      <div className={style.container}>
        <div className={style.toolbar}>
          <BusyFeedback provider={this.props.provider} />
          <WorkbenchLayoutToggleTool
            activeWindow={this.state.activeWindow}
            onActiveWindow={this.onActiveWindow}
            provider={this.props.provider}

            workbench={this.workbench}
          />
          <AnnotationEditorToggleTool
            activeWindow={this.state.activeWindow}
            onActiveWindow={this.onActiveWindow}
            provider={this.props.provider}
          />
          <FieldSelectorToggleTool
            activeWindow={this.state.activeWindow}
            onActiveWindow={this.onActiveWindow}
            provider={this.props.provider}
            overlayVisible={this.props.provider.getActiveFieldNames().length <= 1}
          />
          { this.state.scatterPlotVisible ?
            <ScatterPlotControlToggleTool
              activeWindow={this.state.activeWindow}
              onActiveWindow={this.onActiveWindow}
              provider={this.props.provider}
              scatterPlotManager={this.manager}
              scatterPlotId="workbench"
              // TODO
              activeScores={[0, 1, 2]}
              onActiveScoresChange={() => { console.log('update active scores'); }}
              overlayVisible={this.state.scatterPlotVisible}
              ref={(c) => { this.scatterPlotControl = c; }}
            /> : null
          }
          { this.state.scatterPlotVisible ?
            <section className={style.cameraTools}>
              <ScatterPlotCameraControl manager={this.manager} />
            </section> : null
          }
        </div>
        <div className={style.content}>
          <ComponentToReact className={style.fullSize} component={this.workbench} />
        </div>
      </div>
    );
  }
}

WorkbenchReact.propTypes = {
  // eslint-disable-next-line
  provider: React.PropTypes.object.isRequired,
};

WorkbenchReact.defaultProps = {};
