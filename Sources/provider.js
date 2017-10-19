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
      console.log(id, variables, metadata);
      if (variables.length > 0) {
        model.client.serverAPI().requestHistograms({ hist2D: variables });
      }
    });
    publicAPI.onHistogram1DSubscriptionChange((request) => {
      const { id, variables, metadata } = request;
      // { id: 0, variables: ["2 point shots percentage", "2 point shots percentage"],
      // metadata: {numberOfBins: 32, partial: false, symmetric: true}, }
      console.log(id, variables, metadata);
      if (variables.length > 0) {
        model.client.serverAPI().requestHistograms({ hist1D: variables });
      }
    });

    model.subscriptions.push(model.client.serverAPI().subscribe2DHistogram((data) => {
      if (Array.isArray(data)) {
        data.forEach((hist) => {
          publicAPI.setHistogram2D(hist.data);
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
  });

  publicAPI.setHistogram2dProvider(publicAPI);
}

const DEFAULT_VALUES = {
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
