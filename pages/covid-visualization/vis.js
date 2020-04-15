var _rawData = null;
var _popData = null;
var dateColumns = [];
var _client_width = -1;
var _intial_load = true;

// Resize
$(window).resize(function () {
  if (_rawData != null) {
    var new_width = $("#sizer").width();
    if (_client_width != new_width) {
      render( charts['countries'] );
      render( charts['states'] );
      render( charts['countries-normalized'] );
      render( charts['states-normalized'] );
    }
  }
});


// reducers
var reducer_sum_with_key = function(result, value, key) {
  if (!result[key]) { result[key] = {} }
  let obj = result[key];

  let date = value["Date"];

  if (!obj[date]) { obj[date] = { active: 0, recovered: 0, deaths: 0, cases: 0 } }
  obj[date].active += value["Active"];
  obj[date].recovered += value["Recovered"];
  obj[date].deaths += value["Deaths"];
  obj[date].cases += value["Confirmed"];

  return result;
};

var reducer_byUSstate = function(result, value, key) {
  country = value["Country_Region"];
  state = value["Province_State"];

  if (state == "") { return result; }
  if (country != "United States") { return result; }
  if (state.indexOf("Princess") != -1) { return result; }

  // Use the state name as key
  key = state;
  return reducer_sum_with_key(result, value, key);
};

var reducer_byCountry = function(result, value, key) {
  state = value["Province_State"];
  if (state != "") { return result; }

  key = value["Country_Region"];
  return reducer_sum_with_key(result, value, key);
};



// use a cookie to store country data
// - src: https://www.w3schools.com/js/js_cookies.asp
function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
  var expires = "expires="+d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
  var name = cname + "=";
  var ca = document.cookie.split(';');
  for(var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

// find default state value
var stored;

var defaultState = "New York";
if ((stored = getCookie("state")) != "") { defaultState = stored; }

var defaultCountry = "United States";
if ((stored = getCookie("country")) != "") { defaultCountry = stored; }


// chart metadata
var charts = {
  'countries': {
    reducer: reducer_byCountry,
    scale: "log",
    highlight: defaultCountry,
    defaultHighlight: defaultCountry,
    y0: 100,
    xCap: 25,
    id: "chart-countries",
    normalizePopulation: false,
    show: "50",
    sort: function (d) { return -d.maxCases; },
    dataSelection: 'cases',
    showDelta: false,
    dataSelection_y0: { 'active': 100, 'cases': 100, 'deaths': 10, 'recovered': 100, 'new-cases': 1 },
    yAxisScale: 'fixed',
    xMax: null, yMax: null, data: null,
    trendline: "default"
  },
  'states': {
    reducer: reducer_byUSstate,
    scale: "log",
    highlight: defaultState,
    defaultHighlight: defaultState,
    y0: 20,
    xCap: 40,
    id: "chart-states",
    normalizePopulation: false,
    show: "all",
    sort: function (d) { return -d.maxCases; },
    dataSelection: 'cases',
    dataSelection_y0: { 'active': 20, 'cases': 20, 'deaths': 5, 'recovered': 20 },
    yAxisScale: 'fixed',
    xMax: null, yMax: null, data: null,
    trendline: "default"
  },

  'countries-normalized': {
    reducer: reducer_byCountry,
    scale: "log",
    highlight: defaultCountry,
    defaultHighlight: defaultCountry,
    y0: 1,
    xCap: 25,
    id: "chart-countries-normalized",
    normalizePopulation: "country",
    show: "50",
    sort: function (d) { return -d.maxCases; }, // function (d) { return -d.maxCases + -(d.pop / 1e2); },
    dataSelection: 'cases',
    dataSelection_y0: { 'active': 1, 'cases': 1, 'deaths': 1, 'recovered': 1 },
    yAxisScale: 'fixed',
    xMax: null, yMax: null, data: null,
    trendline: "default"
  },
  'states-normalized': {
    reducer: reducer_byUSstate,
    scale: "log",
    highlight: defaultState,
    defaultHighlight: defaultState,
    y0: 1,
    xCap: 40,
    id: "chart-states-normalized",
    normalizePopulation: "state",
    show: "all",
    sort: function (d) { return -d.maxCases; },
    dataSelection: 'cases',
    dataSelection_y0: { 'active': 1, 'cases': 1, 'deaths': 1, 'recovered': 1 },
    yAxisScale: 'fixed',
    xMax: null, yMax: null, data: null,
    trendline: "default"
  },
};


var findNextExp = function(x) {
  return x * 1.5;
};


var transformToTrailingAverage2 = function (data, period) {
  console.log("transformToTrailingAverage");
  console.log(data);

  var newdata = [];

  for (var i = 0; i < data.length; i++) {
    var sum = 0, ct = 0;
    for (var j = i; j >= 0 && j > i - period; j--) {
      sum += data[j].cases;
      ct++;
    }
    newdata.push( sum / ct );
    console.log( sum / ct );
  }

  for (var i = 0; i < data.length; i++) {
    data[i].cases = newdata[i];
  }
};

var transformToTrailingAverage = function (casesData, period) {
  console.log(casesData);
  for (var countryData of casesData) {
    console.log(countryData.data);
    transformToTrailingAverage2(countryData.data, period);
    
  }
}

var getHTMLCountryOptionsToSelect = function(allCountries, selectedCountry) {
  var html = "";
  for (var country of allCountries) {
    var el_option = $("<option />").val(country).text(country);
    if (selectedCountry == country) { el_option.attr("selected", true); }
    html += el_option.wrap('<p/>').parent().html();
  }
  return html;
}

var prep_data = function(chart) {
  var caseData = chart.fullData;
  var allCountries = _.map(caseData, 'country').sort();
  var highlights = [ chart.highlight ];
  if (chart.extraHighlights) { highlights = highlights.concat( chart.extraHighlights ); }

  switch (chart.show) {
    case "10":
      highlight_data = _.filter(caseData, function(d) { return highlights.indexOf(d.country) != -1; });
      caseData = _.take(caseData, 10);
      for (var hd of highlight_data) {
        if ( !_.find(caseData, function (d) { return d.country == hd.country } ) ) {
          caseData.push(hd);
        }
      }
      break;

    case "50": 
      highlight_data = _.filter(caseData, function(d) { return highlights.indexOf(d.country) != -1; });
      caseData = _.take(caseData, 50);
      for (var hd of highlight_data) {
        if ( !_.find(caseData, function (d) { return d.country == hd.country } ) ) {
          caseData.push(hd);
        }
      }
      break;

    case "highlight-only":
      caseData = _.filter(caseData, function(d) {
        return highlights.indexOf(d.country) != -1;
      });
      break;
  }

  var countries = _.map(caseData, 'country').sort();

  // ensure highlighted country shows when new page load with cookie
  if (countries.indexOf(chart.highlight) == -1) {
    chart.show = "all";
    caseData = chart.fullData;
    countries = _.map(caseData, 'country').sort();
    $("#filter-" + chart.id).val("all");
  }

  /*
  if (countries.indexOf(chart.highlight) == -1) {
    chart.message = "No data on highlight";
  } else {
    chart.message = null;
  }
  */

  var $highlight = $("#highlight-" + chart.id);

  if ($highlight.html().length < 100) { 
    $highlight.html(getHTMLCountryOptionsToSelect(allCountries, chart.highlight));
  }

  if (chart.growthFactor) { transformToTrailingAverage(caseData, 7); }
  chart.data = caseData;
  
  casesMax = _.sortBy(chart.data, function(d) { return -d.maxCases; } )[0];
  chart.yMax = findNextExp(casesMax.maxCases);

  return chart;
};


var process_data = function(data, chart) {
  var agg = _.reduce(data, chart.reducer, {});

  var caseData = [];
  var maxDayCounter = 0;  
  
  for (var country in agg) {
    var popSize = -1;
    if (chart.normalizePopulation) {
      popSize = _popData[chart.normalizePopulation][country];

      if (!popSize && location.hostname === "localhost") {
        console.log("Missing " + chart.normalizePopulation + ": " + country);
      }
    } 

    dayCounter = -1;
    maxCases = 0;
    maxDay = -1;
    lastDayCases = -1;
    countryData = [];
    var dataIndex = 0;
    var dates = Object.keys(agg[country])
    for (var i = 0; i < dates.length; i++) {
      date = dates[i];
      // Start counting days only after the first day w/ 100 cases:
      //console.log(agg[country][date]);
      var cases = agg[country][date][chart.dataSelection];
      var rawCaseValue = cases;

      if (chart.showDelta) {
        if (i == 0) { cases = 0; }
        else {
          prevCases = agg[country][dates[i - 1]][chart.dataSelection];

          if (chart.growthFactor) {
            if (i > 4) {
              var prevCases2 = agg[country][dates[i - 2]][chart.dataSelection];
              dToday = cases - prevCases;
              dYesterday = prevCases - prevCases2;

              if (dToday == 0 || dYesterday == 0) { cases = 0; }
              else { cases = dToday / dYesterday; }
            } else {
              cases = 0;
            }
          } else {
            cases = cases - prevCases;
          }
        }
      }

      if (chart.normalizePopulation) {
        cases = (cases / popSize) * 1e6;
        rawCaseValue = (rawCaseValue / popSize) * 1e6;
      }

      if (dayCounter == -1) {
        if (
          (!chart.growthFactor && cases >= chart.y0) ||
          (!chart.growthFactor && chart.showDelta && rawCaseValue >= chart.y0) ||
          (chart.growthFactor && rawCaseValue >= 100)
        ) {
          dayCounter = 0;
        }
      }
      
      // Once we start counting days, add data
      if (dayCounter > -1) {
        //if (cases >= chart.y0 || (chart.showDelta && cases > 1)) {
        if (cases >= chart.y0 || chart.showDelta) {
          countryData.push({
            pop: popSize,
            country: country,
            dayCounter: dayCounter,
            date: date,
            cases: cases,
            i: dataIndex++
          });

          //if (chart.growthFactor || !(chart.showDelta && cases < 1)) {
          lastDayCases = cases;
          maxDay = dayCounter;
          //}
        }
        if (cases > maxCases) { maxCases = cases; }

        dayCounter++;
      }
    }

    if (maxDay > 0) {
      caseData.push({
        pop: popSize,
        country: country,
        data: countryData,
        maxCases: maxCases,
        maxDay: maxDay,
        lastDayCases: lastDayCases
      });

      if (dayCounter > maxDayCounter) {
        maxDayCounter = dayCounter + 4;
      }
    }
  }

  caseData = _.sortBy(caseData, chart.sort);
  chart.fullData = caseData;

  chart.xMax = maxDayCounter;
  if (chart.xMax > 60) { chart.xMax = 60; }

  prep_data(chart);
  return casesMax;
};

var covidData_promise = d3.csv("jhu-data.csv?d=" + _reqStr, function (row) {
  row["Active"] = +row["Active"];
  row["Confirmed"] = +row["Confirmed"];
  row["Recovered"] = +row["Recovered"];
  row["Deaths"] = +row["Deaths"];
  return row;
});

var populationData_promise = d3.csv("wikipedia-population.csv", function (row) {
  row["Population"] = (+row["Population"]);
  return row;
});


var _dataReady = false, _pageReady = false;


var tryRender = function () {
  if (_dataReady && _pageReady) {
    process_data(_rawData, charts["countries"]);
    render(charts["countries"]);
    setTimeout(initialRender2, 100);
  }
}

var initialRender2 = function() {
  process_data(_rawData, charts["states"]);
  render(charts["states"]);
  
  process_data(_rawData, charts["countries-normalized"]);
  render(charts["countries-normalized"]);

  process_data(_rawData, charts["states-normalized"]);
  render(charts["states-normalized"]);

  _intial_load = false;
};



Promise.all([covidData_promise, populationData_promise])
  .then(function(result) {
    data = result[0];
    populationData = result[1];
    
    _rawData = data;

    _popData = {country: {}, state: {}};
    for (var pop of populationData) {
      if (pop.Country) { _popData.country[pop.Country] = pop.Population; }
      if (pop.State) { _popData.state[pop.State] = pop.Population; }
    }

    _dataReady = true;
    tryRender();
  })
  .catch(function (err) {
    console.error(err);
    alert("Failed to load data.");
  });


var updateAdditionalHighlight = function(e) {
  var chartId = $(e.target).data("chart");
  var chart = charts[chartId];

  var allAdditionalHighlights = $(`.additional-highlight-select[data-chart="${chartId}"]`);
  chart.extraHighlights = _.map( allAdditionalHighlights.toArray(), function (e) { return $(e).val(); } )

  prep_data(chart);
  render(chart);
};

var saveAsSVG = function(e) {
  var chartId = $(e.target).parent().data("chart");
  var chartXML = $(`#chart-${chartId}`).html();
  var hrefData = "data:application/octet-stream;base64," + btoa(chartXML);

  $(e.target).attr("href", "data:application/octet-stream;base64," + btoa(chartXML));
  $(e.target).attr("download", "91-DIVOC-" + chartId + ".svg");
}

var saveAsPNG = function(e) {
  e.preventDefault();

  var chartId = $(e.target).parent().data("chart");
  var chartSVG = $(`#chart-${chartId} svg`);
  var chartXML = $(`#chart-${chartId}`).html();
  var hrefData = "data:image/svg+xml," + encodeURIComponent(chartXML);

  var canvas = $(`<canvas height="${chartSVG.height()}" width="${chartSVG.width()}" />`).get(0);
  var ctx = canvas.getContext('2d');

  var img = new Image(chartSVG.width(), chartSVG.height());
  img.onload = function () {
    console.log("Image loaded.");

    ctx.drawImage(img, 0, 0, chartSVG.width(), chartSVG.height());

    /*
    var downloadData = canvas.toDataURL("image/png");
    saveAs(downloadData, "91-DIVOC-" + chartId + ".png");
    */
     
    canvas.toBlob(function (blob) {
      console.log("Saving.");
      saveAs(blob, "91-DIVOC-" + chartId + ".png");
    })
  }

  //saveAs(downloadData, "linkedin-banner-image.png");

  img.src = hrefData;
  //console.log(uriChart_2);


  /*
  var uriChart = 'data:image/svg+xml,' + encodeURIComponent(chartXML);

  var chartSVG = $(`#chart-${chartId} svg`);
  var chart_element = chartSVG.get(0);
  console.log(chart_element);

  var svgBlob = new Blob([chart_element], {type: 'image/svg+xml;charset=utf-8'});
  var uriChart_2 = URL.createObjectURL(svgBlob);

  var img = new Image();
  img.onload = function () {
    console.log("DONE!");
    alert("UGH");
  }
  img.src = uriChart_2;
  console.log(uriChart_2);


  var canvas = new OffscreenCanvas(chartSVG.width(), chartSVG.height());
  var ctx = canvas.getContext('2d');
  ctx.drawImage( uriChart_2, 0, 0, chartSVG.width(), chartSVG.height() );


  /*
  var chartSVG = $(`#chart-${chartId} svg`);
  var chart_element = chartSVG.get(0);
  console.log(chart_element);



  var canvas = new OffscreenCanvas(chartSVG.width(), chartSVG.height());
  var ctx = canvas.getContext('2d');
  ctx.drawImage( chart_element, 0, 0, chartSVG.width(), chartSVG.height() );
  console.log("DONE!");

  /*
  var img = new Image();
  img.onload = function () {
    ctx.drawImage(img, 0, 0);
    console.log("DONE!");
  }

  img.src = chartSVG.html();
  */
};


$(function() {
  $(".highlight-select").change(function (e) {
    var chartId = $(e.target).data("chart");
    var chart = charts[chartId];
    var val = $(e.target).val();

    chart.highlight = val;

    if (chart.id.indexOf("countries") != -1) { setCookie('country', val, 30); }
    if (chart.id.indexOf("states") != -1) { setCookie('state', val, 30); }

    if ( _.map(chart.data, "country").indexOf(val) == -1 ) {
      prep_data(chart);
    }
    render(chart);
  });

  $(".trendline-select").change(function(e) {
    var chartId = $(e.target).data("chart");
    var chart = charts[chartId];
    
    chart.trendline = $(e.target).val();
    //prep_data(chart);
    render(chart);
  });

  $(".yaxis-select").change(function(e) {
    var chartId = $(e.target).data("chart");
    var chart = charts[chartId];
    
    chart.yAxisScale = $(e.target).val();
    //prep_data(chart);
    render(chart);
  });

  $(".scaleSelection").click(function(e) {
    var value = $(e.target).data("scale");
    var chartId = $(e.target).data("chart");
    var chart = charts[chartId];

    $(`.scaleSelection[data-chart="${chartId}"]`).removeClass('active').prop('checked', false);
    $(e.target).prop('checked', true);
    $(e.target).addClass('active');

    if (chart && chart.scale != value) {
      chart.scale = value;
      render(chart);
    }

    return true;
  });

  $(".filter-select").change(function (e) {
    var chartId = $(e.target).data("chart");
    var chart = charts[chartId];
    
    chart.show = $(e.target).val();
    prep_data(chart);
    render(chart);
  });

  $(".data-select").change(function (e) {
    var chartId = $(e.target).data("chart");
    var chart = charts[chartId];
    var value = $(e.target).val();

    chart.showDelta = false;
    if (value == "cases-daily") {
      value = "cases";
      chart.showDelta = true;
    } else if (value == "deaths-daily") {
      value = "deaths";
      chart.showDelta = true;
    }
    
    chart.growthFactor = false;
    if (value == "growth-cases") {
      value = "cases";
      chart.showDelta = true;
      chart.growthFactor = true;
    } else if (value == "growth-deaths") {
      value = "deaths";
      chart.showDelta = true;
      chart.growthFactor = true;      
    }
    
    chart.dataSelection = value;
    chart.y0 = chart.dataSelection_y0[value];
    process_data(_rawData, chart);
    render(chart);
  });

  $(".add-highlight").click(function (e) {
    e.preventDefault();

    var chartId = $(e.target).data("chart");
    var chart = charts[chartId];
    var el_add = $(`.extra-highlights[data-chart="${chartId}"]`);
    var allCountries = _.map(chart.fullData, 'country').sort();

    var html =
      `<div class="btn-group btn-group-toggle" data-toggle="buttons" style="padding-bottom: 3px;">
          <div class="input-group-prepend">
            <span class="input-group-text">Additional Highlight:</span>
          </div>
          <select class="form-control additional-highlight-select" onchange="updateAdditionalHighlight(event)" data-chart="${chartId}">
            ${getHTMLCountryOptionsToSelect(allCountries, chart.defaultHighlight)}
          </select>
        </div><br>`;

    el_add.append( html );
    if (!chart.extraHighlights) { chart.extraHighlights = []; }
    chart.extraHighlights.push(chart.defaultHighlight);
    render(chart);
  })



  _pageReady = true;
  tryRender();
});


var tip_html = function(chart) {
  return function(d, i) {
    var geometicGrowth = Math.pow(d.cases / chart.y0, 1 / d.dayCounter);
    

    var gData = _.find(chart.data, function (e) { return e.country == d.country }).data;

    var geoGrowth = [];
    if (d.i >= 2) {
      let d0 = gData[i - 1];
      let ggrowth = Math.pow(d.cases / d0.cases, 1 / (d.dayCounter - d0.dayCounter));
      if (isFinite(ggrowth)) {
        geoGrowth.push(`Previous day: <b>${ggrowth.toFixed(2)}x</b> growth`);
      }
    }
    if (d.i >= 8) {
      let d0 = gData[i - 7];
      let ggrowth = Math.pow(d.cases / d0.cases, 1 / (d.dayCounter - d0.dayCounter));
      if (isFinite(ggrowth)) {
        geoGrowth.push(`Previous week: <b>${ggrowth.toFixed(2)}x</b> /day`);
      }
    }
    if (d.i > 0) {
      let d0 = gData[0];
      let ggrowth = Math.pow(d.cases / d0.cases, 1 / (d.dayCounter - d0.dayCounter));
      if (isFinite(ggrowth)) {
        geoGrowth.push(`Previous ${d.dayCounter} days: <b>${ggrowth.toFixed(2)}x</b> /day`);
      }
    }

    var s2 = "";
    if (chart.normalizePopulation) { s2 = " per 1,000,000 people"; }

    var dataLabel = "";
    if (chart.showDelta) { dataLabel = "new "; }

    if (chart.dataSelection == 'cases') { dataLabel += "confirmed cases"; }
    else if (chart.dataSelection == 'active') { dataLabel += "active cases"; }
    else if (chart.dataSelection == 'deaths') { dataLabel += "deaths from COVID-19"; }
    else if (chart.dataSelection == 'recovered') { dataLabel += "recoveries"; }
  
    var s = `<div class="tip-country">${d.country} &ndash; Day ${d.dayCounter}</div>
             <div class="tip-details" style="border-bottom: solid 1px black; padding-bottom: 2px;"><b>${d.cases.toLocaleString("en-US", {maximumFractionDigits: 1})}</b> ${dataLabel}${s2} on ${d.date} (<b>${d.dayCounter}</b> days after reaching ${chart.y0} ${dataLabel}${s2})</div>`;
    
    if (geoGrowth.length > 0) {
      s += `<div class="tip-details"><i><u>Avg. geometric growth</u>:<br>`;
      for (var str of geoGrowth) {
        s += str + "<br>";
      }
      s += `</i></div>`;
    }
    return s;
  }
};

var render = function(chart) {
  // Find data on all highlights
  var highlights = [ chart.highlight ];
  if (chart.extraHighlights) { highlights = highlights.concat( chart.extraHighlights ); }
  
  // Find primary highlight data
  data_y0 = chart.y0;
  gData = undefined;
  var f = _.find(chart.data, function (e) { return e.country == chart.highlight })
  if (f && (gData = f.data) && gData[0]) {
    if (gData[0].cases) { data_y0 = gData[0].cases; }
  }

  var maxDayRendered = chart.xMax;
  if (f && f.maxDay > maxDayRendered) {
    maxDayRendered = f.maxDay + 3;
  }

  var margin = { top: 10, right: 20, bottom: 40, left: 60 };

  var cur_width = $("#sizer").width();
  _client_width = cur_width;

  var width = cur_width - margin.right - margin.left;
  var height = 500;

  var isSmall = false;
  if (width < 400) {
    height = 300;
    isSmall = true;
    margin.left = 40;
  }

  // X-axis scale (days)
  var daysScale = d3.scaleLinear()
                    .domain([0, maxDayRendered])
                    .range([0, width]);

  // Y-axis scale (# of cases)                    
  var casesScale;
  if (chart.scale == "log") { casesScale = d3.scaleLog(); }
  else { casesScale = d3.scaleLinear(); }

  scale_y0 = chart.y0;
  if (chart.showDelta) {
    scale_y0 = 1;
  }

  scale_yMax = chart.yMax;
  if (chart.yAxisScale == "highlight") {
    var highlights_data = _.filter(chart.data, function (d) { return highlights.indexOf(d.country) != -1; });
    var maxCases = _.maxBy(highlights_data, 'maxCases').maxCases;
    scale_yMax = maxCases * 1.2;
  }

  if (chart.growthFactor) {
    scale_y0 = 0.5
    scale_yMax = 2;
  }

  casesScale.domain([scale_y0, scale_yMax]).range([height, 0]);
  
  // Color Scale
  var colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // SVG
  $("#" + chart.id).html("");
  var svg = d3.select("#" + chart.id)
    .append("svg")
    .attr("version", 1.1)
    .attr("xmlns", "http://www.w3.org/2000/svg")    
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .style("width", width + margin.left + margin.right)
    .style("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Mouseovers
  var tip = d3.tip().attr('class', 'd3-tip').html(tip_html(chart));
  svg.call(tip);

  // Axes
  var x_axis = d3.axisBottom(daysScale);
  svg.append('g')
     .attr("transform", "translate(0, " + height + ")")
     .attr("class", "axis")
     .call(x_axis);  
  
  var x_grid = d3.axisBottom(daysScale).tickSize(-height).tickFormat("");
  svg.append('g')
     .attr("transform", "translate(0, " + height + ")")
     .attr("class", "grid")
     .call(x_grid);

  // Have tickValues at 1, 5, 10, 50, 100, ...
  var tickValue = 1;
  var tickValueIncrease = 5; 
  var tickValues = [];
  while (tickValue <= 1e6) {
    if (tickValue >= scale_y0 && tickValue <= scale_yMax) { tickValues.push(tickValue); }
    tickValue *= tickValueIncrease;

    if (tickValueIncrease == 5) { tickValueIncrease = 2; }
    else { tickValueIncrease = 5; }
  }

  var y_axis = d3.axisLeft(casesScale).tickFormat(
    (!isSmall)?d3.format("0,"):function (val) {
      var oom = Math.log10(val);

      if (oom <= 3) { return val.toFixed(0); }
      else if (oom <= 6) { return ((val / 1000).toFixed(0)) + "k"; }
      else if (oom <= 9) { return ((val / 1e6).toFixed(0)) + "m"; }
      else if (oom <= 12) { return ((val / 1e9).toFixed(0)) + "b"; }
      else { return val; }
  }); 
  if (chart.scale == "log" && scale_yMax / scale_y0 > 100) { y_axis.tickValues(tickValues); }
  
  svg.append('g')
    .attr("class", "axis")
    .call(y_axis);  

  var y_grid = d3.axisLeft(casesScale).tickSize(-width).tickFormat("");
  svg.append('g')
     .attr("class", "grid")
     .call(y_grid);
    


  // Add Data
  // Create 35%-line
  let scaleLinesMeta = [];
  if (chart.trendline == "default" || chart.trendline == "35" || chart.trendline == "all") {
    scaleLinesMeta.push({ is35pct: true, dStart: 0, dasharray: 12, label: "1.35x daily", sLabel: "35%", gRate: 1.35 });
  }

  var getSacleMeta = function(gData, f, dayTrend, dasharray) {
    if (gData.length == 0) { return null; }

    var d = gData[gData.length - 1];
    d0 = _.find(gData, function (e) { return e.dayCounter == d.dayCounter - dayTrend; });

    if (!d0) { return null; }

    let ggrowth = Math.pow(d.cases / d0.cases, 1 / (d.dayCounter - d0.dayCounter));

    let s = ggrowth.toFixed(2) + `x (prev. ${dayTrend}-day growth)`;

    return {
      dasharray: dasharray,
      color: colorScale(f.country),
      label: s,
      sLabel: s,
      gRate: ggrowth,
      y0: d.cases / Math.pow(ggrowth, d.dayCounter),
      dStart: d0.dayCounter
    };
  };
  
  if (chart.trendline == "highlight-1week" || chart.trendline == "all") {
    var scaleMetadata = getSacleMeta(gData, f, 7, 6);
    if (scaleMetadata) { scaleLinesMeta.push( scaleMetadata ); }
  }

  if (chart.trendline == "highlight-3day" || chart.trendline == "all") {
    var scaleMetadata = getSacleMeta(gData, f, 3, 4);
    if (scaleMetadata) { scaleLinesMeta.push( scaleMetadata ); }
  }

  if (chart.trendline == "highlight-1day" || chart.trendline == "all") {
    var scaleMetadata = getSacleMeta(gData, f, 1, 2);
    if (scaleMetadata) { scaleLinesMeta.push( scaleMetadata ); }
  }

  var xTop_visualOffset = -5;
  for (var scaleLineMeta of scaleLinesMeta) {
    var cases = data_y0, day = 0, y_atMax = -1, y_atStart = -1;
    if (scaleLineMeta.y0) {
      cases = scaleLineMeta.y0;
    }
    var pctLine = [];
    while (day < maxDayRendered + 3) {
      if (day >= scaleLineMeta.dStart) {
        pctLine.push({
          dayCounter: day,
          cases: cases
        })

        if (y_atStart == -1) { y_atStart = cases; }
      }

      if (day == maxDayRendered) { y_atMax = cases; }
      day++;
      cases *= scaleLineMeta.gRate;
    }
  
    svg.datum(pctLine)
      .append("path")
      .attr("fill", "none")
      .attr("stroke", function() {
        if (scaleLineMeta.color) { return scaleLineMeta.color; }
        else { return "black"; }
      })
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", scaleLineMeta.dasharray)
      .attr("d", d3.line()
        .x(function (d) { return daysScale(d.dayCounter); })
        .y(function (d) { return casesScale(d.cases); })
      );
  
    svg.append("text")
      .attr("class", "label-country")
      .attr("x", function() {
        if (y_atMax > scale_yMax) { /* extends off the top */
          return daysScale(
            Math.log( scale_yMax / y_atStart )  / Math.log( scaleLineMeta.gRate ) + scaleLineMeta.dStart
          );
        } else if (y_atMax < scale_y0) { /* extends off bottom */ 
          return daysScale(
            Math.log( 1 / y_atStart ) / Math.log( scaleLineMeta.gRate ) + scaleLineMeta.dStart
          );
        } else { /* extends off right */
          return width;
        }
      })
      .attr("y", function () {
        if (y_atMax > scale_yMax) { /* extends off the top */
          if (!scaleLineMeta.is35pct) { xTop_visualOffset += 10; return xTop_visualOffset; }
          else { if (isSmall) { return -2; } return 5; }
          
        } else if (y_atMax < scale_y0) { /* extends off bottom */ 
          return height;
        } else { /* extends off right */
          return casesScale(y_atMax);
        }
      })
      .attr("text-anchor", "end")
      .style("font-size", (isSmall)?"8px":"10px")
      .attr("fill", function() {
        if (scaleLineMeta.color) { return scaleLineMeta.color; }
        else { return "black"; }
      })
      .text(function() {
        return scaleLineMeta.label;
      })
  }
  


  var xAxisLabel = `Days since ${chart.y0} `
  if (chart.dataSelection == 'cases') { xAxisLabel += "case"; if (chart.y0 != 1) { xAxisLabel += "s"; }}
  else if (chart.dataSelection == 'active') { xAxisLabel += "active case"; if (chart.y0 != 1) { xAxisLabel += "s"; }}
  else if (chart.dataSelection == 'deaths') { xAxisLabel += "death"; if (chart.y0 != 1) { xAxisLabel += "s"; } }
  else if (chart.dataSelection == 'recovered') { xAxisLabel += "recover"; if (chart.y0 != 1) { xAxisLabel += "ies"; } else { xAxisLabel += "y"; }}
  if (chart.normalizePopulation) { xAxisLabel += "/1m people"; }
  //if (chart.showDelta) { xAxisLabel += "/day"; }

  svg.append("text")
     .attr("x", width - 5)
     .attr("y", height - 5)
     .attr("class", "axis-title")
     .attr("text-anchor", "end")
     .text(xAxisLabel);

  var yAxisLabel = "";
  if (chart.showDelta) { yAxisLabel += "New Daily "; }
  if (chart.dataSelection == 'cases') { yAxisLabel += "Confirmed Cases"; }
  else if (chart.dataSelection == 'active') { yAxisLabel += "Active Cases"; }
  else if (chart.dataSelection == 'deaths') { yAxisLabel += "COVID-19 Deaths"; }
  else if (chart.dataSelection == 'recovered') { yAxisLabel += "Recoveries" }
  if (chart.normalizePopulation) {
    yAxisLabel += "/1m people";
  }

  svg.append("text")
     .attr("transform", "rotate(-90)")
     .attr("x", -2)
     .attr("y", 15)
     .attr("class", "axis-title")
     .attr("text-anchor", "end")
     .text(yAxisLabel);

  svg.append("text")
    .attr("x", width)
    .attr("y", height + 32)
    .attr("class", "text-credits")
    .attr("text-anchor", "end")
    .text(`Data: Johns Hopkins CSSE; Updated: ${_dateUpdated}`);

  chart.data.sort(function (d1, d2) {
    var highlight_d1 = ( highlights.indexOf(d1.country) != -1 );
    var highlight_d2 = ( highlights.indexOf(d2.country) != -1 );

    if      ( highlight_d1 && !highlight_d2) { return 1; }
    else if (!highlight_d1 &&  highlight_d2) { return -1; }
    else { return 0; }
  });

  var renderLineChart = function(svg, i) {
    var countryData = chart.data[i];
    var isHighlighted = (highlights.indexOf(countryData.country) != -1);

    svg.datum(countryData.data)
      .append("path")
      .attr("fill", "none")
      .attr("stroke", function (d) { return colorScale(d[0].country); } )
      .attr("stroke-width", function (d) {
        if (isHighlighted) { return 4; }
        else { return 1; }
      })
      .style("opacity", function (d) {
        if (isHighlighted) { return 1; }
        else { return (isSmall) ? 0.15 : 0.3; }
      })      
      .attr("d", d3.line()
        .x(function (d) { return daysScale(d.dayCounter); })
        .y(function (d) { return casesScale(d.cases); })
        .defined(function (d, i, a) {
          return (d.cases >= scale_y0);
        })
      );

    svg.selectAll("countries")
      .data(countryData.data)
      .enter()
      .append("circle")
      .attr("cx", function (d) { return daysScale(d.dayCounter); } )
      .attr("cy", function (d) {
        if (d.cases < scale_y0) { return height + 5; }
        return casesScale(d.cases);
      } )
      .style("opacity", function (d) {
        if (isHighlighted) { return 1; }
        else { return (isSmall) ? 0.15 : 0.3; }
      })
      .attr("r", function (d) {
        if (d.cases < scale_y0) {
          if (isHighlighted) { return 4; }
          else { return 0; }
        }
        if (isHighlighted) { return 4; }
        else { return 3; }
      })
      .attr("fill", function (d) { return colorScale(d.country); })
      .on('mouseover', tip.show)
      .on('mouseout', tip.hide);

    var countryText = svg.append("text")
      .attr("fill", function (d) { return colorScale(countryData.data[0].country); })
      .attr("class", "label-country")
      .style("opacity", function () {
        if (isHighlighted) { return 1; }
        else { return 0.3; }
      })
      .style("font-size", function () {
        if (isHighlighted) { return "15px"; }
        else { return null; }
      })
      .text(countryData.country);

    if (countryData.maxDay + 2 < maxDayRendered || !countryData.data[maxDayRendered - 1]) { 
      countryText
        .attr("x", 5 + daysScale(countryData.maxDay) )
        .attr("y", function () {
          if (countryData.lastDayCases < scale_y0) { return height + 5; }
          return casesScale(countryData.lastDayCases);
        })
        .attr("alignment-baseline", "middle")
    } else {
      countryText
        .attr("x", daysScale(maxDayRendered) - 5 )
        .attr("y", function () {
          if (countryData.data[maxDayRendered - 1].cases < scale_y0) { return height + 5; }
          return casesScale(countryData.data[maxDayRendered - 1].cases) - 5;
        })
        .attr("text-anchor", "end")
    }
  };

  for (var i = 0; i < chart.data.length; i++) {
    renderLineChart(svg, i);
  }

  if (!f) {
    var desc = `${chart.y0} `
    if (chart.dataSelection == 'cases') { desc += "case"; if (chart.y0 != 1) { desc += "s"; }}
    else if (chart.dataSelection == 'active') { desc += "active case"; if (chart.y0 != 1) { desc += "s"; }}
    else if (chart.dataSelection == 'deaths') { desc += "death"; if (chart.y0 != 1) { desc += "s"; } }
    else if (chart.dataSelection == 'recovered') { desc += "recover"; if (chart.y0 != 1) { desc += "ies"; } else { desc += "y"; }}
    if (chart.normalizePopulation) { desc += "/1m people"; }

    $("#" + chart.id).append(`<div style="text-align: center;"><i><b>Note:</b> ${chart.highlight} has not reached ${desc}. No data is available to highlight.</i></div>`);
  }
};
