var dscc = require('@google/dscc');
var ChartJS = require('chart.js');
var Chart = ChartJS.Chart;
Chart.register.apply(Chart, ChartJS.registerables);

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
  if (hex.indexOf('rgba') === 0) return hex;
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function formatCurrency(value, symbol) {
  if (!symbol) return value.toLocaleString();
  return symbol + value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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

// ── Create or get the tooltip element ───────────────────────
function getOrCreateTooltipEl() {
  var el = document.getElementById('viz-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'viz-tooltip';
    el.style.cssText = [
      'position:absolute',
      'pointer-events:none',
      'background:#fff',
      'border:1px solid #dadce0',
      'border-radius:8px',
      'padding:12px 16px',
      'font-family:Arial,sans-serif',
      'font-size:12px',
      'color:#202124',
      'box-shadow:0 2px 8px rgba(0,0,0,0.15)',
      'z-index:9999',
      'opacity:0',
      'transition:opacity 0.15s ease, left 0.1s ease, top 0.1s ease',
      'white-space:nowrap',
      'min-width:180px'
    ].join(';');
    document.body.appendChild(el);
  }
  return el;
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

    // ── Read style options ──────────────────────────────────
    var style = data.style || {};

    var showTitle       = styleVal(style, 'showTitle', true);
    var chartTitle      = styleVal(style, 'chartTitle', 'Y/Y Revenue');
    var titleFontFamily = styleVal(style, 'titleFontFamily', 'Arial');
    var titleFontSize   = parseInt(styleVal(style, 'titleFontSize', '20'), 10);
    var titleFontColor  = getFontColor(style, 'titleFontColor', '#000000');

    var barPct         = parseFloat(styleVal(style, 'barPercentage', '0.95'));
    var showDataLabels = styleVal(style, 'showDataLabels', false);
    var borderRad      = parseInt(styleVal(style, 'barBorderRadius', '2'), 10);
    var currencySymbol = styleVal(style, 'currencySymbol', '$');

    var metricColors = [];
    for (var ci = 0; ci < metricIdxs.length; ci++) {
      metricColors.push(getColor(style, 'color' + (ci + 1), DEFAULT_COLORS[ci]));
    }

    var lyOpacity = styleVal(style, 'lyOpacity', 0.5);
    if (typeof lyOpacity === 'object' && lyOpacity !== null) lyOpacity = 0.5;

    var showAxes       = styleVal(style, 'showAxes', true);
    var axisColor      = getFontColor(style, 'axisColor', '#5f6368');
    var showYAxisTitle = styleVal(style, 'showYAxisTitle', false);
    var showXAxisTitle = styleVal(style, 'showXAxisTitle', false);
    var xFontFamily    = styleVal(style, 'xFontFamily', 'Arial');
    var xFontSize      = parseInt(styleVal(style, 'xFontSize', '12'), 10);
    var xFontColor     = getFontColor(style, 'xFontColor', '#5f6368');
    var xRotation      = parseInt(styleVal(style, 'xRotation', '0'), 10);

    var showXGridlines = styleVal(style, 'showXGridlines', false);
    var showYGridlines = styleVal(style, 'showYGridlines', true);
    var gridlineColor  = getFontColor(style, 'gridlineColor', '#e0e0e0');

    var showLegend      = styleVal(style, 'showLegend', true);
    var legendPosition  = styleVal(style, 'legendPosition', 'top');
    var legendFontFamily = styleVal(style, 'legendFontFamily', 'Arial');
    var legendFontSize  = parseInt(styleVal(style, 'legendFontSize', '12'), 10);
    var legendFontColor = getFontColor(style, 'legendFontColor', '#5f6368');

    // ── BUILD DATASETS ──────────────────────────────────────
    var datasets = [];

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
          _metricIndex: mIdx,
          _compIndex: cIdx,
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

    // ── Custom legend plugin — metric names only ────────────
    var customLegendPlugin = {
      id: 'metricLegend',
      afterDraw: function(chart) {
        if (!showLegend) return;
        var c = chart.ctx;
        var chartArea = chart.chartArea;
        var boxSize = 12;
        var pad = 6;
        var gap = 18;

        c.save();
        c.font = legendFontSize + 'px ' + legendFontFamily;
        c.textBaseline = 'middle';

        var items = metricNames.map(function(name, idx) {
          return { label: name, color: metricColors[idx] || DEFAULT_COLORS[idx] };
        });

        var totalW = 0;
        items.forEach(function(item) {
          totalW += boxSize + pad + c.measureText(item.label).width + gap;
        });
        totalW -= gap;

        var x = chartArea.left + (chartArea.width - totalW) / 2;
        var y = showTitle ? titleFontSize + 16 : 10;

        items.forEach(function(item) {
          c.fillStyle = item.color;
          c.fillRect(x, y, boxSize, boxSize);
          x += boxSize + pad;
          c.fillStyle = legendFontColor;
          c.fillText(item.label, x, y + boxSize / 2);
          x += c.measureText(item.label).width + gap;
        });
        c.restore();
      }
    };

    // ── External HTML tooltip (white, Looker-style) ─────────
    var externalTooltipHandler = function(context) {
      var tooltip = context.tooltip;
      var tooltipEl = getOrCreateTooltipEl();

      // Hide if no tooltip
      if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = '0';
        return;
      }

      // Get the hovered dataset info
      var dataIndex = tooltip.dataPoints[0].dataIndex;
      var hoveredDs = tooltip.dataPoints[0].dataset;
      var stackId = hoveredDs.stack;
      var compIdx = hoveredDs._compIndex;
      var compName = compLabels[compIdx] || '';
      var timeLabel = timeLabels[dataIndex] || '';

      // Title row
      var html = '<div style="font-weight:700;font-size:13px;color:#202124;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e8eaed">';
      html += timeLabel + ' - ' + compName;
      html += '</div>';

      // Metric rows — table layout for alignment
      html += '<table style="border-collapse:collapse;width:100%">';
      var total = 0;

      // Find all datasets in same stack
      context.chart.data.datasets.forEach(function(ds) {
        if (ds.stack === stackId) {
          var val = ds.data[dataIndex] || 0;
          total += val;
          var mIdx = ds._metricIndex;
          var color = metricColors[mIdx] || DEFAULT_COLORS[mIdx];
          var name = metricNames[mIdx];

          html += '<tr style="line-height:22px">';
          // Color square
          html += '<td style="width:16px;padding-right:8px"><div style="width:12px;height:12px;border-radius:2px;background:' + color + '"></div></td>';
          // Metric name
          html += '<td style="color:#5f6368;padding-right:16px;max-width:140px;overflow:hidden;text-overflow:ellipsis">' + name + '</td>';
          // Value — right aligned
          html += '<td style="text-align:right;font-weight:500;color:#202124">' + formatCurrency(val, currencySymbol) + '</td>';
          html += '</tr>';
        }
      });

      // Total row
      html += '<tr style="line-height:26px;border-top:1px solid #e8eaed">';
      html += '<td></td>';
      html += '<td style="color:#202124;font-weight:700;padding-top:4px">Total</td>';
      html += '<td style="text-align:right;font-weight:700;color:#202124;padding-top:4px">' + formatCurrency(total, currencySymbol) + '</td>';
      html += '</tr>';

      html += '</table>';

      tooltipEl.innerHTML = html;

      // Position — keep tooltip fully visible inside the iframe
      var canvasRect = context.chart.canvas.getBoundingClientRect();
      var tooltipWidth = tooltipEl.offsetWidth || 220;
      var tooltipHeight = tooltipEl.offsetHeight || 120;
      var iframeWidth = document.documentElement.clientWidth || window.innerWidth;
      var iframeHeight = document.documentElement.clientHeight || window.innerHeight;

      // Horizontal: prefer right of cursor, flip left if clipped
      var tooltipX = canvasRect.left + tooltip.caretX + 12;
      if (tooltipX + tooltipWidth > iframeWidth - 8) {
        tooltipX = canvasRect.left + tooltip.caretX - tooltipWidth - 12;
      }
      if (tooltipX < 4) tooltipX = 4;

      // Vertical: prefer above the cursor so it doesn't get clipped at bottom
      var tooltipY = canvasRect.top + tooltip.caretY - tooltipHeight - 8;
      // If that goes above the iframe top, show below instead
      if (tooltipY < 4) {
        tooltipY = canvasRect.top + tooltip.caretY + 12;
      }
      // Final check: if still clipped at bottom, pin to bottom edge
      if (tooltipY + tooltipHeight > iframeHeight - 4) {
        tooltipY = iframeHeight - tooltipHeight - 4;
      }

      tooltipEl.style.left = tooltipX + 'px';
      tooltipEl.style.top = tooltipY + 'px';
      tooltipEl.style.opacity = '1';
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
            top: showLegend ? 34 : 8,
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
            padding: { bottom: showLegend ? 16 : 12 }
          },
          legend: {
            display: false
          },
          tooltip: {
            enabled: false,
            external: externalTooltipHandler
          }
        },
        scales: {
          x: {
            stacked: true,
            display: showAxes,
            type: 'category',
            grid: { display: showXGridlines, color: gridlineColor },
            ticks: {
              font: { family: xFontFamily, size: xFontSize },
              color: xFontColor,
              maxRotation: xRotation,
              minRotation: xRotation,
              autoSkip: false
            },
            title: { display: showXAxisTitle, text: 'Time Period', color: xFontColor },
            border: { color: axisColor }
          },
          y: {
            stacked: true,
            display: showAxes,
            beginAtZero: true,
            grid: { display: showYGridlines, color: gridlineColor },
            ticks: {
              font: { family: xFontFamily, size: xFontSize },
              color: xFontColor,
              callback: function(v) {
                if (currencySymbol) {
                  if (v >= 1000000) return currencySymbol + (v / 1000000).toFixed(1) + 'M';
                  if (v >= 1000) return currencySymbol + (v / 1000).toFixed(0) + 'K';
                  return currencySymbol + v;
                }
                if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
                if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
                return v;
              }
            },
            title: { display: showYAxisTitle, text: 'Value', color: xFontColor },
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
                c.fillText(formatCurrency(v, currencySymbol), bar.x, bar.y + (bar.height || 0) / 2);
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

if (typeof window !== 'undefined') {
  window.drawViz = drawViz;
}

dscc.subscribeToData(drawViz, { transform: dscc.tableTransform });