/* global window, document */
import React from 'react';

import Workbench from 'paraviewweb/src/Component/Native/Workbench';
import ReactAdapter from 'paraviewweb/src/Component/React/ReactAdapter';
import ComponentToReact from 'paraviewweb/src/Component/React/ComponentToReact';

// import CompositeClosureHelper from 'paraviewweb/src/Common/Core/CompositeClosureHelper';

import HistogramSelector from 'paraviewweb/src/InfoViz/Native/HistogramSelector';
import FieldSelector from 'paraviewweb/src/InfoViz/Native/FieldSelector';
import MutualInformationDiagram from 'paraviewweb/src/InfoViz/Native/MutualInformationDiagram';
import ParallelCoordinates from 'paraviewweb/src/InfoViz/Native/ParallelCoordinates';

import AnnotationEditorWidget from 'paraviewweb/src/React/Widgets/AnnotationEditorWidget';

import BusyFeedback from 'paraviewweb/src/React/Widgets/BusyFeedback';
import CountToolbar from 'paraviewweb/src/React/Widgets/CountToolbar';
import AnnotationEditorToggleTool from 'paraviewweb/src/React/ToggleTools/AnnotationEditor';
import FieldSelectorToggleTool from 'paraviewweb/src/React/ToggleTools/FieldSelector';
import ParallelCoordinatesToggleTool from 'paraviewweb/src/React/ToggleTools/ParallelCoordinates';
import WorkbenchLayoutToggleTool from 'paraviewweb/src/React/ToggleTools/WorkbenchLayout';
import ScatterPlotControlToggleTool from 'paraviewweb/src/React/ToggleTools/ScatterPlotControl';
import ScatterPlotCameraControl from 'paraviewweb/src/React/Widgets/ScatterPlotCameraControl';

import style from './WorkbenchReact.mcss';

export default class WorkbenchReact extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      scatterPlotVisible: false,
      activeScores: [],
    };

    this.onActiveWindow = this.onActiveWindow.bind(this);
    this.resize = this.resize.bind(this);
    this.updateActiveScores = this.updateActiveScores.bind(this);
  }

  componentWillMount() {
    this.subscriptions = [];

    const { provider } = this.props;
    // Create viz components
    const histogramSelector = HistogramSelector.newInstance({ provider });

    const fieldSelector = FieldSelector.newInstance({ provider });

    const diag = MutualInformationDiagram.newInstance({ provider });
    diag.propagateAnnotationInsteadOfSelection(true, 0, 1);

    this.parallelCoordinates = ParallelCoordinates.newInstance({ provider });
    this.parallelCoordinates.propagateAnnotationInsteadOfSelection(true, 0, 1);
    this.scores = provider.getScores();
    // 'unselected' or unscored data is represented by an index equal to the number of scores.
    this.unselectedScoreIndex = this.scores.length;
    // all scores active initially, including the 'unselected' value, the last index.
    const activeScores = this.scores.map(score => score.index);
    activeScores.push(this.unselectedScoreIndex);
    this.setState({ activeScores });

    const annotationWidgetProps = {
      annotation: null,
      scores: this.scores,
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
        component: this.parallelCoordinates,
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
      const { component, index /* , count */ } = event;
      // console.log(
      //   component ? component : 'none', index, count,
      //   index === -1 || index >= count ? 'hidden' : 'visible',
      // );
      if (index !== -1 && component === this.manager.getRemoteRenderer('workbench-scatterplot')) {
        // Tell scatterplot to update before first render.
        this.manager.updateModel(this.manager.getModel());
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

  updateActiveScores(activeScores) {
    this.props.provider.getClient().serverAPI().setActiveScores(activeScores).then(() => {
      this.manager.getRemoteRenderer('workbench-scatterplot').render(true);
    });

    if (this.parallelCoordinates) {
      // filter the unselected index
      this.parallelCoordinates.setVisibleScoresForSelection(activeScores.filter(s => s < this.unselectedScoreIndex));
      // background is shown if unselected is in the list.
      this.parallelCoordinates.setShowOnlySelection(activeScores.indexOf(this.unselectedScoreIndex) === -1);
      this.parallelCoordinates.render();
    }

    this.setState({ activeScores });
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
          <CountToolbar
            provider={this.props.provider}
            activeScores={this.state.activeScores}
            onChange={this.updateActiveScores}
          />
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
          <ParallelCoordinatesToggleTool
            activeWindow={this.state.activeWindow}
            onActiveWindow={this.onActiveWindow}
            provider={this.props.provider}

            showOnlySelection={this.state.activeScores.indexOf(this.unselectedScoreIndex) === -1}
            partitionScores={this.state.activeScores.filter(s => s < this.unselectedScoreIndex)}
          />
          { this.state.scatterPlotVisible ?
            <ScatterPlotControlToggleTool
              activeWindow={this.state.activeWindow}
              onActiveWindow={this.onActiveWindow}
              provider={this.props.provider}
              scatterPlotManager={this.manager}
              scatterPlotId="workbench"
              activeScores={this.state.activeScores}
              onActiveScoresChange={this.updateActiveScores}
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
