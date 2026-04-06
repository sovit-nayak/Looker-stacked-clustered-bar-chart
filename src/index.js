var dscc = require('@google/dscc');
var ChartJS = require('chart.js');
var Chart = ChartJS.Chart;
Chart.register.apply(Chart, ChartJS.registerables);

// Default Freeosk brand colors
var DEFAULT_COLORS = ['#F37021', '#0072BA', '#FFC20E', '#52BFEE', '#76777A',
  '#F37021', '#0072BA', '#FFC20E', '#52BFEE', '#76777A'];

var chartInstance = null;

function styleVal(styleObj, id, fallback) {
  if (!styleObj || !styleObj[id]) return fallback;
  var v = styleObj[id];
  if (typeof v.value !== 'undefined') return v.value;
  if (typeof v.defaultValue !== 'undefined') return v.defaultValue;
  return fallback;
}

function getColor(styleObj, id, fallback) {
  if (!styleObj || !styleObj[id]) return fallback;
  var v = styleObj[id];
  if (v.value && v.value.color) return v.value.color;
  if (v.defaultValue && v.defaultValue.color) return v.defaultValue.color;
  if (typeof v.value === 'string') return v.value;
  return fallback;
}

function getFontColor(styleObj, id, fallback) {
  if (!styleObj || !styleObj[id]) return fallback;
  var v = styleObj[id];
  if (v.value && v.value.color) return v.value.color;
  if (v.defaultValue && v.defaultValue.color) return v.defaultValue.color;
  return fallback;
}

function hexToRgba(hex, alpha) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function renderError(title, detail) {
  var old = document.getElementById('viz-container');
  if (old) old.remove();
  var prev = document.getElementById('viz-error');
  if (prev) prev.remove();
  var el = document.createElement('div');
  el.id = 'viz-error';
  el.innerHTML =
    '<div class="error-title">' + title + '</div>' +
    '<div class="error-detail">' + detail + '</div>';
  document.body.appendChild(el);
}

function drawViz(data) {
  try {
    var tableData = data.tables.DEFAULT;
    var headers = tableData.headers;
    var rows = tableData.rows;

    if (!rows || rows.length === 0) {
      return renderError('No data', 'Add a Time dimension, Comparison dimension, and at least 1 Metric.');
    }

    var timeIdx = -1, compIdx = -1;
    var metricIdxs = [];

    headers.forEach(function(h, i) {
      if (h.configId === 'timeDimension') timeIdx = i;
      else if (h.configId === 'comparisonDimension') compIdx = i;
      else if (h.configId === 'metric') metricIdxs.push(i);
    });

    if (timeIdx < 0 || compIdx < 0 || metricIdxs.length === 0) {
      return renderError('Missing fields', 'Need 1 Time Period, 1 Comparison Group, and at least 1 Metric.');
    }

    // Collect unique labels preserving order
    var timeLabels = [];
    var timeLabelsSet = {};
    var compLabels = [];
    var compLabelsSet = {};
    rows.forEach(function(r) {
      var t = String(r[timeIdx]);
      var c = String(r[compIdx]);
      if (!timeLabelsSet[t]) { timeLabels.push(t); timeLabelsSet[t] = true; }
      if (!compLabelsSet[c]) { compLabels.push(c); compLabelsSet[c] = true; }
    });
    var metricNames = metricIdxs.map(function(i) { return headers[i].name; });

    // Build lookup: time -> comp -> [metric values]
    var lookup = {};
    timeLabels.forEach(function(t) {
      lookup[t] = {};
      compLabels.forEach(function(c) {
        lookup[t][c] = metricIdxs.map(function() { return 0; });
      });
    });
    rows.forEach(function(r) {
      var t = String(r[timeIdx]);
      var c = String(r[compIdx]);
      metricIdxs.forEach(function(mi, idx) {
        lookup[t][c][idx] += (Number(r[mi]) || 0);
      });
    });

    // ── Read all style options ──────────────────────────────
    var style = data.style || {};

    // Title
    var showTitle       = styleVal(style, 'showTitle', true);
    var chartTitle      = styleVal(style, 'chartTitle', 'Y/Y Revenue');
    var titleFontFamily = styleVal(style, 'titleFontFamily', 'Arial');
    var titleFontSize   = parseInt(styleVal(style, 'titleFontSize', '20'), 10);
    var titleFontColor  = getFontColor(style, 'titleFontColor', '#000000');

    // Bars
    var barPct          = parseFloat(styleVal(style, 'barPercentage', '0.95'));
    var showDataLabels  = styleVal(style, 'showDataLabels', false);
    var borderRad       = parseInt(styleVal(style, 'borderRadius', '2'), 10);

    // Colors — one per metric from the style panel
    var metricColors = [];
    for (var ci = 0; ci < metricIdxs.length; ci++) {
      var colorId = 'color' + (ci + 1);
      metricColors.push(getColor(style, colorId, DEFAULT_COLORS[ci]));
    }

    // LY opacity
    var lyOpacity = styleVal(style, 'lyOpacity', 0.5);
    if (typeof lyOpacity === 'object' && lyOpacity !== null) lyOpacity = 0.5;

    // Axes
    var showAxes       = styleVal(style, 'showAxes', true);
    var axisColor      = getFontColor(style, 'axisColor', '#5f6368');
    var showYAxisTitle = styleVal(style, 'showYAxisTitle', false);
    var showXAxisTitle = styleVal(style, 'showXAxisTitle', false);
    var xFontFamily    = styleVal(style, 'xFontFamily', 'Arial');
    var xFontSize      = parseInt(styleVal(style, 'xFontSize', '12'), 10);
    var xFontColor     = getFontColor(style, 'xFontColor', '#5f6368');
    var xRotation      = parseInt(styleVal(style, 'xRotation', '0'), 10);

    // Grid
    var showXGridlines = styleVal(style, 'showXGridlines', false);
    var showYGridlines = styleVal(style, 'showYGridlines', true);
    var gridlineColor  = getFontColor(style, 'gridlineColor', '#e0e0e0');

    // Legend
    var showLegend      = styleVal(style, 'showLegend', true);
    var legendPosition  = styleVal(style, 'legendPosition', 'top');
    var legendFontFamily = styleVal(style, 'legendFontFamily', 'Arial');
    var legendFontSize  = parseInt(styleVal(style, 'legendFontSize', '12'), 10);
    var legendFontColor = getFontColor(style, 'legendFontColor', '#5f6368');

    // ── BUILD DATASETS ──────────────────────────────────────
    //
    // SAME color for LY and TY per metric.
    // LY = lower opacity, TY = full opacity.
    // Legend shows metric names only (not LY/TY per metric).

    var datasets = [];
    var numComps = compLabels.length;

    compLabels.forEach(function(comp, cIdx) {
      var stackId = 'stack_' + cIdx;
      var isLY = cIdx === 0;
      var alpha = isLY ? lyOpacity : 1.0;

      metricNames.forEach(function(mName, mIdx) {
        var baseColor = metricColors[mIdx] || DEFAULT_COLORS[mIdx];
        var dataPoints = timeLabels.map(function(t) { return lookup[t][comp][mIdx]; });

        datasets.push({
          label: comp + ' \u2014 ' + mName,
          data: dataPoints,
          backgroundColor: hexToRgba(baseColor, alpha),
          borderColor: hexToRgba(baseColor, Math.min(alpha + 0.2, 1)),
          borderWidth: 0.5,
          borderRadius: borderRad,
          borderSkipped: false,
          stack: stackId,
          categoryPercentage: 0.9,
          barPercentage: barPct,
          // Store metadata for custom legend
          _metricIndex: mIdx,
          _compIndex: cIdx,
          _metricName: mName,
          _compName: comp,
          _baseColor: baseColor
        });
      });
    });

    // ── Prepare DOM ─────────────────────────────────────────
    var errEl = document.getElementById('viz-error');
    if (errEl) errEl.remove();
    var container = document.getElementById('viz-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'viz-container';
      document.body.appendChild(container);
    }
    container.innerHTML = '';
    var canvas = document.createElement('canvas');
    canvas.id = 'chartCanvas';
    container.appendChild(canvas);
    canvas.width = dscc.getWidth();
    canvas.height = dscc.getHeight();

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    var ctx = canvas.getContext('2d');

    // ── Custom legend plugin ────────────────────────────────
    // Shows one entry per METRIC (not per dataset),
    // with a solid square of the metric color.
    var customLegendPlugin = {
      id: 'customLegend',
      afterDraw: function(chart) {
        if (!showLegend) return;

        var ctx = chart.ctx;
        var chartArea = chart.chartArea;
        var boxSize = 12;
        var padding = 8;
        var itemGap = 20;

        // Build legend items: one per metric
        var items = metricNames.map(function(name, idx) {
          return {
            label: name,
            color: metricColors[idx] || DEFAULT_COLORS[idx]
          };
        });

        // Add LY/TY indicators
        if (numComps > 1) {
          items.push({
            label: compLabels[0] + ' (faded)',
            color: hexToRgba(metricColors[0] || DEFAULT_COLORS[0], lyOpacity)
          });
          items.push({
            label: compLabels[1] + ' (solid)',
            color: metricColors[0] || DEFAULT_COLORS[0]
          });
        }

        // Measure total width
        ctx.font = legendFontSize + 'px ' + legendFontFamily;
        var totalWidth = 0;
        items.forEach(function(item) {
          totalWidth += boxSize + padding + ctx.measureText(item.label).width + itemGap;
        });
        totalWidth -= itemGap;

        // Position
        var x = chartArea.left + (chartArea.width - totalWidth) / 2;
        var y = 8;

        ctx.textBaseline = 'middle';
        items.forEach(function(item) {
          // Color box
          ctx.fillStyle = item.color;
          ctx.fillRect(x, y, boxSize, boxSize);
          ctx.strokeStyle = '#ccc';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, boxSize, boxSize);
          x += boxSize + padding;

          // Label
          ctx.fillStyle = legendFontColor;
          ctx.fillText(item.label, x, y + boxSize / 2);
          x += ctx.measureText(item.label).width + itemGap;
        });
      }
    };

    // ── Render Chart ────────────────────────────────────────
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: { labels: timeLabels, datasets: datasets },
      plugins: [customLegendPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: showLegend ? 30 : 8,
            right: 12,
            bottom: 4,
            left: 12
          }
        },
        plugins: {
          title: {
            display: showTitle,
            text: chartTitle,
            font: { family: titleFontFamily, size: titleFontSize, weight: '600' },
            color: titleFontColor,
            padding: { bottom: showLegend ? 4 : 12 }
          },
          legend: {
            display: false  // Using custom legend instead
          },
          tooltip: {
            backgroundColor: 'rgba(32,33,36,0.92)',
            titleFont: { family: 'Arial', size: 12, weight: '600' },
            bodyFont: { family: 'Arial', size: 12 },
            cornerRadius: 6,
            padding: 10,
            callbacks: {
              label: function(context) {
                return ' ' + context.dataset.label + ': ' + context.parsed.y.toLocaleString();
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            display: showAxes,
            grid: {
              display: showXGridlines,
              color: gridlineColor
            },
            ticks: {
              font: { family: xFontFamily, size: xFontSize },
              color: xFontColor,
              maxRotation: xRotation,
              minRotation: xRotation
            },
            title: {
              display: showXAxisTitle,
              text: 'Time Period',
              color: xFontColor
            },
            border: { color: axisColor }
          },
          y: {
            stacked: true,
            display: showAxes,
            beginAtZero: true,
            grid: {
              display: showYGridlines,
              color: gridlineColor
            },
            ticks: {
              font: { family: xFontFamily, size: xFontSize },
              color: xFontColor,
              callback: function(v) {
                if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
                if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
                return v;
              }
            },
            title: {
              display: showYAxisTitle,
              text: 'Value',
              color: xFontColor
            },
            border: { display: false }
          }
        },
        animation: { duration: 500, easing: 'easeOutQuart' }
      }
    });

    // Data labels
    if (showDataLabels) {
      chartInstance.options.animation.onComplete = function() {
        var c = chartInstance.ctx;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = '10px Arial';
        chartInstance.data.datasets.forEach(function(ds, di) {
          var meta = chartInstance.getDatasetMeta(di);
          if (!meta.hidden) {
            meta.data.forEach(function(bar, i) {
              var v = ds.data[i];
              if (v && Math.abs(bar.height || 0) > 14) {
                c.fillStyle = '#fff';
                c.fillText(
                  v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toString(),
                  bar.x, bar.y + (bar.height || 0) / 2
                );
              }
            });
          }
        });
      };
      chartInstance.update();
    }
  } catch (err) {
    renderError('Rendering error', err.message || String(err));
  }
}

// Expose for local testing
if (typeof window !== 'undefined') {
  window.drawViz = drawViz;
}

dscc.subscribeToData(drawViz, { transform: dscc.tableTransform });