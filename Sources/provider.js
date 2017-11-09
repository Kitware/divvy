/* global window, document */
import 'babel-polyfill';

import CompositeClosureHelper from 'paraviewweb/src/Common/Core/CompositeClosureHelper';

// import AnnotationStoreProvider from 'paraviewweb/src/InfoViz/Core/AnnotationStoreProvider';
import FieldProvider from 'paraviewweb/src/InfoViz/Core/FieldProvider';
import LegendProvider from 'paraviewweb/src/InfoViz/Core/LegendProvider';
import Histogram1DProvider from 'paraviewweb/src/InfoViz/Core/Histogram1DProvider';
import Histogram2DProvider from 'paraviewweb/src/InfoViz/Core/Histogram2DProvider';
import HistogramBinHoverProvider from 'paraviewweb/src/InfoViz/Core/HistogramBinHoverProvider';
import ScoresProvider from 'paraviewweb/src/InfoViz/Core/ScoresProvider';
import SelectionProvider from 'paraviewweb/src/InfoViz/Core/SelectionProvider';
import MutualInformationProvider from 'paraviewweb/src/InfoViz/Core/MutualInformationProvider';
// import PersistentStateProvider from 'paraviewweb/src/InfoViz/Core/PersistentStateProvider';

function divvyProvider(publicAPI, model) {
  model.client.onReady(() => {
    // model.client.setBusyListener(publicAPI.fireBusy);
    const fieldList = model.client.getFieldList();
    Object.keys(fieldList).forEach((field) => {
      publicAPI.addField(field, fieldList[field]);
    });
    // set provider behaviors
    publicAPI.setFieldsSorted(true);
    publicAPI.getFieldNames().forEach((name) => {
      publicAPI.addLegendEntry(name);
    });
    publicAPI.assignLegend(['colors', 'shapes']);

    // activate scoring gui
    publicAPI.setScores(model.client.getScores());
    publicAPI.setDefaultScore(2);

    // whenever the list of 2D histogram subscriptions change,
    // request any that we don't have in our cache.
    publicAPI.onHistogram2DSubscriptionChange((request) => {
      const { id, variables /* , metadata */ } = request;
      // { id: 0, variables: [["2 point shots percentage", "2 point shots percentage"],...],
      // metadata: {numberOfBins: 32, partial: false, symmetric: true}, }
      if (variables.length > 0) {
        const needList = [];
        variables.forEach((pair) => {
          if (!publicAPI.hasHistogram2D(request, pair)) {
            needList.push(pair);
          }
        });
        if (needList.length > 0) {
          // console.log(id, variables, metadata);
          model.client.serverAPI().requestHistograms({ hist2D: needList });
        }
      }
      // TODO: Shortcut hack - we know id 1 is parallel coords. It needs selection histos
      if (id === 1) {
        model.client.serverAPI().requestAnnotationHistograms({ hist2D: variables });
        // if there's an annotation, re-calc its histograms.
        if (publicAPI.getAnnotation()) publicAPI.fireAnnotationChange(publicAPI.getAnnotation());
      }
    });
    publicAPI.onHistogram1DSubscriptionChange((request) => {
      const { variables } = request;
      // { id: 0, variables: ["2 point shots percentage", "2 point shots percentage"],
      // metadata: {numberOfBins: 32, partial: false, symmetric: true}, }
      // console.log(id, variables, metadata);
      if (variables.length > 0) {
        model.client.serverAPI().requestHistograms({ hist1D: variables });
      }
    });

    model.subscriptions.push(model.client.serverAPI().subscribe2DHistogram((data) => {
      if (Array.isArray(data)) {
        data.forEach((hist) => {
          if (hist.selection) {
            // a new range annotation will generate 2d histograms of the selection.
            publicAPI.setSelectionData(hist);
          } else {
            publicAPI.setHistogram2D(hist.data);
          }
        });
      } else {
        console.error('Non array response from subscribe2DHistogram');
      }
    }));
    model.subscriptions.push(model.client.serverAPI().subscribe1DHistogram((data) => {
      if (Array.isArray(data)) {
        data.forEach((hist) => {
          publicAPI.setHistogram1D(hist.data);
        });
      } else {
        console.error('Non array response from subscribe1DHistogram');
      }
    }));
    model.subscriptions.push(model.client.serverAPI().subscribeSelectionCount((data) => {
      if (Array.isArray(data)) {
        data.forEach((item) => {
          // this is 'count' data - for each score, a count of how many rows
          // fall under that score.
          publicAPI.setSelectionData(item);
        });
      } else {
        console.error('Non array response from subscribeSelectionCount');
      }
    }));

    publicAPI.onAnnotationChange((annotation) => {
      // Capture any partition annotation
      if (annotation.selection.type === 'partition') {
        model.fieldPartitions[annotation.selection.partition.variable] = annotation;
      }

      model.client.serverAPI().updateAnnotation(annotation)
        .then(
          (result) => {
            // console.log('updateAnnotation result', result);
          },
          (code, reason) => {
            console.error('updateAnnotation failed: ', code, reason);
          },
        );
    });
  });

  publicAPI.setHistogram2dProvider(publicAPI);

  publicAPI.getClient = () => model.client;

  publicAPI.getDataRowCount = () => model.client.getNumberOfRows();
}

const DEFAULT_VALUES = {
  fieldPartitions: {},
};

// const toggleView = new ToggleControl(green, red);
export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);
  // AnnotationStoreProvider.extend(publicAPI, model);
  FieldProvider.extend(publicAPI, model, initialValues);
  Histogram1DProvider.extend(publicAPI, model, initialValues);
  Histogram2DProvider.extend(publicAPI, model, initialValues);
  HistogramBinHoverProvider.extend(publicAPI, model);
  LegendProvider.extend(publicAPI, model, initialValues);
  ScoresProvider.extend(publicAPI, model, initialValues);
  SelectionProvider.extend(publicAPI, model, initialValues);
  MutualInformationProvider.extend(publicAPI, model, initialValues);
  // PersistentStateProvider.extend(publicAPI, model);

  CompositeClosureHelper.set(publicAPI, model, ['scatterPlotManager']);
  CompositeClosureHelper.get(publicAPI, model, ['scatterPlotManager']);
  CompositeClosureHelper.event(publicAPI, model, 'busy');
  divvyProvider(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = CompositeClosureHelper.newInstance(extend);

// ----------------------------------------------------------------------------

export default { newInstance, extend };
