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

// function listToPair(list = []) {
//   const size = list.length;
//   const pairList = [];
//   list.forEach((name, idx) => {
//     for (let i = idx; i < size; i++) {
//       pairList.push([name, list[i]]);
//     }
//   });
//   return pairList;
// }

function divvyProvider(publicAPI, model) {
  model.client.onReady(() => {
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
    const scores = [
      { name: 'Interesting', color: '#66c2a5', value: 1 },
      { name: 'Exciting', color: '#fc8d62', value: 5 },
      { name: 'Neutral', color: '#8da0cb', value: 0 },
      { name: 'Bland', color: '#e78ac3', value: -2 },
      { name: 'Other', color: '#a6d854', value: 2 },
    ];
    publicAPI.setScores(scores);
    publicAPI.setDefaultScore(0);

    // whenever the list of active fields change, update our
    // 2D histogram subscriptions
    // publicAPI.onFieldChange((field) => {
    //   const activeFieldNames = publicAPI.getActiveFieldNames();
    //   if (activeFieldNames.length > 1) {
    //     console.log(activeFieldNames);
    //     model.client.serverAPI().requestHistograms({ hist2D: listToPair(activeFieldNames) });
    //   }
    // });
    publicAPI.onHistogram2DSubscriptionChange((request) => {
      const { id, variables, metadata } = request;
      // { id: 0, variables: [["2 point shots percentage", "2 point shots percentage"]],
      // metadata: {numberOfBins: 32, partial: false, symmetric: true}, }
      if (variables.length > 0) {
        const needList = [];
        variables.forEach((pair) => {
          if (!publicAPI.hasHistogram2D(request, pair)) {
            needList.push(pair);
          }
        });
        if (needList.length > 0) {
          console.log(id, variables, metadata);
          model.client.serverAPI().requestHistograms({ hist2D: needList });
        }
      }
      // Shortcut hack - we know id 1 is parallel coords. It needs selection histos
      if (id === 1) {
        model.client.serverAPI().requestAnnotationHistograms({ hist2D: variables });
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
    publicAPI.onAnnotationChange((annotation) => {
      // Capture any partition annotation
      if (annotation.selection.type === 'partition') {
        model.fieldPartitions[annotation.selection.partition.variable] = annotation;
      }

      model.client.serverAPI().updateAnnotation(annotation)
        .then(
          (result) => {
            console.log('updateAnnotation result', result);
          },
          (code, reason) => {
            console.error('updateAnnotation failed: ', code, reason);
          },
        );
    });
  });

  publicAPI.setHistogram2dProvider(publicAPI);
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

  divvyProvider(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = CompositeClosureHelper.newInstance(extend);

// ----------------------------------------------------------------------------

export default { newInstance, extend };
