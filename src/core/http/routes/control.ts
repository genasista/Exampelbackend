import { Router } from "express";

const r = Router();

// Lightweight Control Center page: /control/usage
r.get("/usage", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Control Center — Daily Usage</title>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 20px; }
    .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    label { font-size: 14px; }
    input, select, button { padding: 6px 8px; font-size: 14px; }
    #empty { color: #666; margin-top: 8px; }
  </style>
  </head>
  <body>
    <h1>Daily Usage</h1>
    <div class="row">
      <label>School ID <input id="school" type="number" value="1" min="1" /></label>
      <label>From <input id="from" type="date" /></label>
      <label>To <input id="to" type="date" /></label>
      <button id="load">Load</button>
      <span id="status"></span>
    </div>
    <canvas id="chart" height="120"></canvas>
    <div id="empty" style="display:none">No data for selected filters.</div>

    <script>
      const statusEl = document.getElementById('status');
      const emptyEl = document.getElementById('empty');
      const ctx = document.getElementById('chart');
      let chart;

      async function fetchData() {
        const school = document.getElementById('school').value;
        const from = document.getElementById('from').value;
        const to = document.getElementById('to').value;
        const u = new URL('/usage/daily', location.origin);
        if (school) u.searchParams.set('schoolId', school);
        if (from) u.searchParams.set('from', from);
        if (to) u.searchParams.set('to', to);
        statusEl.textContent = 'Loading…';
        try {
          const r = await fetch(u.toString(), { headers: { 'X-Api-Key': (localStorage.getItem('apiKey')||'demo-key'), 'X-School-Id': school } });
          const body = await r.json();
          render(body.items || []);
          statusEl.textContent = '';
        } catch (e) {
          statusEl.textContent = 'Error loading data';
        }
      }

      function render(items){
        const labels = items.map(x => x.day);
        const data = items.map(x => x.count);
        emptyEl.style.display = items.length ? 'none' : 'block';
        if (chart) { chart.destroy(); }
        chart = new Chart(ctx, {
          type: 'line',
          data: { labels, datasets: [{ label: 'API calls', data, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.15)', tension: .2, fill: true }] },
          options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
        });
      }

      document.getElementById('load').addEventListener('click', fetchData);
      // default range: last 14 days
      const d = new Date();
      const to = d.toISOString().slice(0,10);
      d.setDate(d.getDate()-13);
      const from = d.toISOString().slice(0,10);
      document.getElementById('from').value = from;
      document.getElementById('to').value = to;
      fetchData();
    </script>
  </body>
</html>`);
});

export default r;


