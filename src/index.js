var dscc = require('@google/dscc');
var ChartJS = require('chart.js');
var Chart = ChartJS.Chart;
Chart.register.apply(Chart, ChartJS.registerables);

const PALETTES = {
  vibrant: ['#4285F4','#EA4335','#FBBC04','#34A853','#FF6D01','#46BDC6','#7BAAF7','#F07B72'],
  pastel: ['#A8D5E2','#F9A8C9','#FBE3A1','#B5E2C4','#D4A8E2','#F5C9A8','#A8C9E2','#E2A8D5'],
  corporate: ['#1A3A5C','#2E6B8A','#4A90B8','#6BB5D6','#5C3A1A','#8A6B2E','#B8904A','#D6B56B']
};

let chartInstance = null;

function styleVal(styleObj, id, fallback) {
  if (!styleObj || !styleObj[id]) return fallback;
  const v = styleObj[id];
  if (typeof v.value !== 'undefined') return v.value;
  if (typeof v.defaultValue !== 'undefined') return v.defaultValue;
  return fallback;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function renderError(title, detail) {
  const old = document.getElementById('viz-container');
  if (old) old.remove();
  const prev = document.getElementById('viz-error');
  if (prev) prev.remove();
  const el = document.createElement('div');
  el.id = 'viz-error';
  el.innerHTML =
    '<div class="error-title">' + title + '</div>' +
    '<div class="error-detail">' + detail + '</div>';
  document.body.appendChild(el);
}

function drawViz(data) {
  try {
    const tableData = data.tables.DEFAULT;
    const headers = tableData.headers;
    const rows = tableData.rows;

    if (!rows || rows.length === 0) {
      return renderError('No data', 'Add a Time dimension, Comparison dimension, and at least 1 Metric.');
    }

    let timeIdx = -1, compIdx = -1;
    const metricIdxs = [];

    headers.forEach(function(h, i) {
      if (h.configId === 'timeDimension') timeIdx = i;
      else if (h.configId === 'comparisonDimension') compIdx = i;
      else if (h.configId === 'metric') metricIdxs.push(i);
    });

    if (timeIdx < 0 || compIdx < 0 || metricIdxs.length === 0) {
      return renderError('Missing fields', 'Need 1 Time Period, 1 Comparison Group, and at least 1 Metric.');
    }

    const timeLabelsMap = {};
    const compLabelsMap = {};
    rows.forEach(function(r) {
      timeLabelsMap[r[timeIdx]] = true;
      compLabelsMap[r[compIdx]] = true;
    });
    const timeLabels = Object.keys(timeLabelsMap);
    const compLabels = Object.keys(compLabelsMap);
    const metricNames = metricIdxs.map(function(i) { return headers[i].name; });

    const lookup = {};
    timeLabels.forEach(function(t) {
      lookup[t] = {};
      compLabels.forEach(function(c) {
        lookup[t][c] = metricIdxs.map(function() { return 0; });
      });
    });
    rows.forEach(function(r) {
      const t = r[timeIdx];
      const c = r[compIdx];
      metricIdxs.forEach(function(mi, idx) {
        lookup[t][c][idx] += (Number(r[mi]) || 0);
      });
    });

    const style = data.style || {};
    const paletteName = styleVal(style, 'barColors', 'vibrant');
    const showLegend = styleVal(style, 'showLegend', true);
    const showValues = styleVal(style, 'showValues', false);
    const borderRadius = parseInt(styleVal(style, 'borderRadius', '2'), 10);
    const chartTitle = styleVal(style, 'chartTitle', '');
    const palette = PALETTES[paletteName] || PALETTES.vibrant;

    const datasets = [];
    const numComps = compLabels.length;

    compLabels.forEach(function(comp, cIdx) {
      const stackId = 'stack_' + cIdx;
      const alpha = cIdx === 0 ? 0.5 : 1.0;

      metricNames.forEach(function(mName, mIdx) {
        const baseColor = palette[mIdx % palette.length];
        const dataPoints = timeLabels.map(function(t) { return lookup[t][comp][mIdx]; });

        datasets.push({
          label: numComps > 1 ? comp + ' \u2014 ' + mName : mName,
          data: dataPoints,
          backgroundColor: hexToRgba(baseColor, alpha),
          borderColor: baseColor,
          borderWidth: cIdx === 0 ? 0 : 1,
          borderRadius: borderRadius,
          borderSkipped: false,
          stack: stackId,
          categoryPercentage: 0.9,
          barPercentage: 0.95
        });
      });
    });

    const errEl = document.getElementById('viz-error');
    if (errEl) errEl.remove();
    let container = document.getElementById('viz-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'viz-container';
      document.body.appendChild(container);
    }
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'chartCanvas';
    container.appendChild(canvas);
    canvas.width = dscc.getWidth();
    canvas.height = dscc.getHeight();

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    const ctx = canvas.getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: { labels: timeLabels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 12, bottom: 4, left: 12 } },
        plugins: {
          title: {
            display: !!chartTitle,
            text: chartTitle,
            font: { size: 16, weight: '600' },
            color: '#202124',
            padding: { bottom: 12 }
          },
          legend: {
            display: showLegend,
            position: 'top',
            labels: {
              font: { size: 11 },
              color: '#5f6368',
              boxWidth: 12,
              padding: 10,
              usePointStyle: true,
              pointStyle: 'rectRounded'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(32,33,36,0.92)',
            cornerRadius: 8,
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
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#5f6368' },
            border: { color: '#dadce0' }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: '#f1f3f4' },
            ticks: {
              font: { size: 11 },
              color: '#5f6368',
              callback: function(v) {
                if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
                if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
                return v;
              }
            },
            border: { display: false }
          }
        },
        animation: { duration: 500, easing: 'easeOutQuart' }
      }
    });

    if (showValues) {
      chartInstance.options.animation.onComplete = function() {
        const c = chartInstance.ctx;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = '10px sans-serif';
        chartInstance.data.datasets.forEach(function(ds, di) {
          const meta = chartInstance.getDatasetMeta(di);
          if (!meta.hidden) {
            meta.data.forEach(function(bar, i) {
              const v = ds.data[i];
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

if (typeof window !== 'undefined') {
  window.drawViz = drawViz;
}
dscc.subscribeToData(drawViz, { transform: dscc.tableTransform });
