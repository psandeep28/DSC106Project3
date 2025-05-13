const width = 1000, height = 580, innerRadius = 100, outerRadius = 160;
const svg = d3.select("#radialChart").append("g").attr("transform", `translate(${width / 4}, ${height / 2})`);
const svg2 = d3.select("#radialChart").append("g").attr("transform", `translate(${(3 * width) / 4}, ${height / 2})`);
const tooltip = d3.select(".tooltip");
const lineChart = d3.select("#lineChart");
const miniChart = d3.select("#miniMap");
let miniBrush = null;

let selectedHours = [];
const estrusDays = [2, 6, 10, 14];

Promise.all([
  d3.csv("radial_activity_summary.csv"),
  d3.csv("hourly_activity_by_mouse.csv")
]).then(([summary, lines]) => {
  summary.forEach(d => {
    d.Hour = +d.Hour;
    d.AvgActivity = +d.AvgActivity;
    d.StdActivity = +d.StdActivity;
    d.PercentActive = +d.PercentActive;
  });

  d3.select("#resetButton").on("click", () => {
    selectedHours = [];
    d3.selectAll(".hourArc")
      .attr("stroke", "none")
      .attr("stroke-width", 0);
    lineChart.selectAll("*").remove();
    miniChart.selectAll("*").remove();
  
    // Properly reset the brush selection
    if (miniBrush) {
      miniChart.select(".brush").call(miniBrush.move, null);
    }
  });
  
  

  lines.forEach(d => {
    d.Hour = +d.Hour;
    d.Day = +d.Day;
    d.AvgActivity = +d.AvgActivity;
  });

  const color = d3.scaleSequential(d3.interpolateMagma)
    .domain([0, d3.max(summary, d => d.AvgActivity)]);

  const arc = d3.arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .startAngle(d => (d.Hour / 24) * 2 * Math.PI)
    .endAngle(d => ((d.Hour + 1) / 24) * 2 * Math.PI);

  function drawClock(container, data, sexLabel, clickCallback) {
    container.selectAll("path")
      .data(data)
      .enter()
      .append("path")
      .attr("class", "hourArc")
      .attr("d", arc)
      .attr("fill", d => color(d.AvgActivity))
      .attr("stroke", "none")
      .on("mouseover", (event, d) => {
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip.html(`Hour: ${d.Hour}:00<br>Avg: ${d.AvgActivity.toFixed(1)}<br>Std: ${d.StdActivity.toFixed(1)}<br>% Active: ${d.PercentActive.toFixed(1)}%`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 30) + "px");
      })
      .on("mouseout", () => tooltip.transition().duration(300).style("opacity", 0))
      .on("click", (event, d) => clickCallback(d.Hour));

    container.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -outerRadius - 50)
      .attr("font-weight", "bold")
      .text(sexLabel);
  }
  const femaleData = summary.filter(d => d.Sex === "Female");
  const maleData = summary.filter(d => d.Sex === "Male");

  drawClock(svg, femaleData, "Female", handleBrushClick);
  drawClock(svg2, maleData, "Male", handleBrushClick);

  const labelArc = d3.arc().innerRadius(outerRadius + 20).outerRadius(outerRadius + 20);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  [svg, svg2].forEach(s => {
    s.selectAll(".tick")
      .data(hours)
      .enter()
      .append("text")
      .attr("transform", d => `translate(${labelArc.centroid({ Hour: d, startAngle: (d / 24) * 2 * Math.PI, endAngle: ((d + 1) / 24) * 2 * Math.PI })})`)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#000")
      .text(d => `${(d === 0 ? 12 : d > 12 ? d - 12 : d)} ${d < 12 ? "AM" : "PM"}`);
  });

  // Color Legend
  const defs = d3.select("svg#radialChart").append("defs");
  const linearGradient = defs.append("linearGradient").attr("id", "legend-gradient");

  linearGradient.selectAll("stop")
    .data(d3.ticks(0, 1, 10))
    .enter().append("stop")
    .attr("offset", d => `${d * 100}%`)
    .attr("stop-color", d => d3.interpolateMagma(d));

  const legendGroup = d3.select("svg#radialChart")
    .append("g")
    .attr("transform", `translate(${(width / 2) - 100}, ${height - 40})`);

  legendGroup.append("rect")
    .attr("width", 200)
    .attr("height", 10)
    .style("fill", "url(#legend-gradient)")
    .style("stroke", "#ccc");

  const minVal = d3.min(summary, d => d.AvgActivity);
  const maxVal = d3.max(summary, d => d.AvgActivity);

  legendGroup.append("text")
    .attr("x", 0).attr("y", 22)
    .attr("text-anchor", "start").attr("font-size", "10px")
    .text(minVal.toFixed(1));

  legendGroup.append("text")
    .attr("x", 200).attr("y", 22)
    .attr("text-anchor", "end").attr("font-size", "10px")
    .text(maxVal.toFixed(1));

  legendGroup.append("text")
    .attr("x", 100).attr("y", 35)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px").attr("font-weight", "bold")
    .text("Average Activity Level");

  function handleBrushClick(hour) {
    if (selectedHours.includes(hour)) {
      selectedHours = selectedHours.filter(h => h !== hour);
    } else {
      selectedHours.push(hour);
    }

    d3.selectAll(".hourArc")
      .attr("stroke", d => selectedHours.includes(d.Hour) ? "#fff" : "none")
      .attr("stroke-width", d => selectedHours.includes(d.Hour) ? 2 : 0);

    if (selectedHours.length > 0) {
      drawLineChart(lines, selectedHours);
    } else {
      lineChart.selectAll("*").remove();
      miniChart.selectAll("*").remove();
    }
  }
  function drawLineChart(data, hourList) {
    const grouped = d3.rollups(
      data.filter(d => hourList.includes(d.Hour)),
      v => ({ AvgActivity: d3.mean(v, d => d.AvgActivity), Sex: v[0].Sex }),
      d => d.MouseID,
      d => d.Day
    );

    const mouseDataMap = new Map();
    grouped.forEach(([mouseID, days]) => {
      const arr = Array.from(days, ([day, val]) => ({
        MouseID: mouseID,
        Day: +day,
        AvgActivity: val.AvgActivity,
        Sex: val.Sex
      }));
      mouseDataMap.set(mouseID, arr);
    });

    const mice = Array.from(mouseDataMap.keys());

    const x = d3.scaleLinear().domain([1, 14]).range([60, 860]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.AvgActivity)]).range([260, 20]);

    lineChart.selectAll("*").remove();

    estrusDays.forEach(day => {
      lineChart.append("line")
        .attr("x1", x(day)).attr("x2", x(day))
        .attr("y1", 20).attr("y2", 260)
        .attr("stroke", "deeppink")
        .attr("stroke-dasharray", "4");

        lineChart.append("text")
  .attr("x", x(day) + 3)
  .attr("y", 30)
  .attr("fill", "deeppink")
  .attr("font-size", "10px")
  .text("Estrus Day ");

    });

    lineChart.append("g")
      .attr("transform", "translate(0,260)")
      .call(d3.axisBottom(x).ticks(14).tickFormat(d => `Day ${d}`));

    lineChart.append("text")
      .attr("x", 450).attr("y", 295)
      .attr("text-anchor", "middle")
      .attr("font-size", "13px")
      .attr("font-weight", "bold")
      .text("Day");

    lineChart.append("g")
      .attr("transform", "translate(60,0)")
      .call(d3.axisLeft(y));

    lineChart.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -140).attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("font-size", "13px")
      .attr("font-weight", "bold")
      .text("Avg Activity");

    const line = d3.line().x(d => x(d.Day)).y(d => y(d.AvgActivity));

    mice.forEach(mouse => {
      const mouseData = mouseDataMap.get(mouse);
      const color = mouseData[0].Sex === "Female" ? "#d62728" : "#1f77b4";

      lineChart.append("path")
        .datum(mouseData)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .attr("d", line)
        .on("mouseover", function () {
          d3.selectAll("path").style("opacity", 0.2);
          d3.select(this).style("opacity", 1).attr("stroke-width", 3);
        })
        .on("mouseout", function () {
          d3.selectAll("path").style("opacity", 1);
          d3.select(this).attr("stroke-width", 1.5);
        });

      const maxPoint = mouseData.reduce((a, b) => a.AvgActivity > b.AvgActivity ? a : b);
      lineChart.append("circle")
        .attr("cx", x(maxPoint.Day))
        .attr("cy", y(maxPoint.AvgActivity))
        .attr("r", 4)
        .attr("fill", color);

      lineChart.append("text")
        .attr("x", x(maxPoint.Day))
        .attr("y", y(maxPoint.AvgActivity) - 10)
        .attr("dx", "-10")
        .attr("fill", color)
        .attr("font-size", "12px")
        .attr("text-anchor", "end")
        .text(`Peak: ${maxPoint.AvgActivity.toFixed(1)}`);
    });

    lineChart.append("text")
      .attr("x", 450)
      .attr("y", 10)
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .attr("text-anchor", "middle")
      .text(`Activity for Hours: ${hourList.sort((a, b) => a - b).join(", ")}`);

    const legendLine = lineChart.append("g")
      .attr("transform", "translate(700, 30)");

    const legendData = [
      { label: "Female", color: "#d62728" },
      { label: "Male", color: "#1f77b4" }
    ];

    legendLine.selectAll("rect")
      .data(legendData)
      .enter().append("rect")
      .attr("x", 0)
      .attr("y", (d, i) => i * 20)
      .attr("width", 12).attr("height", 12)
      .attr("fill", d => d.color);

    legendLine.selectAll("text")
      .data(legendData)
      .enter().append("text")
      .attr("x", 18)
      .attr("y", (d, i) => i * 20 + 10)
      .text(d => d.label)
      .attr("font-size", "12px")
      .attr("alignment-baseline", "middle");

    drawMiniMap(mouseDataMap, hourList);
  }
  function drawMiniMap(mouseDataMap, hourList) {
    const xMini = d3.scaleLinear().domain([1, 14]).range([60, 860]);
    const yMini = d3.scaleLinear()
      .domain([0, d3.max(Array.from(mouseDataMap.values()).flat(), d => d.AvgActivity)])
      .range([100, 0]);
  
    miniChart.selectAll("*").remove();
  
    miniChart.append("g")
      .attr("transform", "translate(0,100)")
      .call(d3.axisBottom(xMini).ticks(14));
  
    const lineMini = d3.line()
      .x(d => xMini(d.Day))
      .y(d => yMini(d.AvgActivity));
  
    mouseDataMap.forEach(mouseData => {
      miniChart.append("path")
        .datum(mouseData)
        .attr("fill", "none")
        .attr("stroke", mouseData[0].Sex === "Female" ? "#d62728" : "#1f77b4")
        .attr("stroke-width", 1)
        .attr("d", lineMini);
    });
  
    miniBrush = d3.brushX()
      .extent([[60, 0], [860, 100]])
      .on("end", event => {
        if (!event.selection) return;
  
        const [x0, x1] = event.selection.map(xMini.invert);
        const dayRange = d3.range(Math.ceil(x0), Math.floor(x1) + 1);
  
        const filteredData = lines.filter(d => {
          return hourList.includes(d.Hour) && dayRange.includes(d.Day);
        });
  
        drawLineChart(filteredData, hourList);
      });
  
    miniChart.append("g")
      .attr("class", "brush")
      .call(miniBrush);
  }
  
});

