frappe.provide('construction_suite');

frappe.pages['project-estimator'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Project Estimator',
		single_column: true
	});

	new construction_suite.ProjectEstimator(page);
};

construction_suite.ProjectEstimator = class ProjectEstimator {
	constructor(page) {
		this.page = page;
		this.$container = $(page.body);

		this.hardness_factor = 1.2;
		this.last_inputs = null;
		this.extra_compliance_count = 0;

		this.roles = [
			{ name: "Engineer", rate: 300, def: 1 },
			{ name: "Site Supervisor", rate: 250, def: 1 },
			{ name: "Safety Supervisor", rate: 250, def: 1 },
			{ name: "Lifting Supervisor", rate: 250, def: 1 },
			{ name: "Rotator Operator", rate: 300, def: 1 },
			{ name: "Crane Operator", rate: 400, def: 1 },
			{ name: "Excavator Operator", rate: 250, def: 1 },
			{ name: "Rigger Man", rate: 200, def: 2 },
			{ name: "Signal Man", rate: 200, def: 1 },
			{ name: "Welder", rate: 250, def: 1 },
		];

		this.crane_models = {
			"custom": { rate: 0, mob: 0 },
			"90T Crawler Crane": { rate: 800, mob: 15000 },
			"TK750 Crawler Crane": { rate: 1000, mob: 5000 },
			"7120GFS Crawler Crane": { rate: 1000, mob: 15000 },
		};
		this.rotator_models = {
			"custom": { rate: 0, mob: 0 },
			"RT150": { rate: 1000, mob: 3000 },
			"RT200": { rate: 1500, mob: 3000 },
			"RT210C": { rate: 1200, mob: 12000 },
		};

		this.setup();
	}

	setup() {
		this.setup_styles();
		this.render();
		this.bind_static_events();
		this.build_worker_table();
		this.on_crane_change();
		this.on_rotator_change();
		this.update_mob_preview();
		this.load_history();
	}

	el(id) {
		return document.getElementById(id);
	}

	val(id) {
		const node = this.el(id);
		return node ? node.value : '';
	}

	fmt(n) {
		return 'S$ ' + Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	holes_per_day(dia) {
		if (dia <= 300) return 6;
		if (dia <= 500) return 3;
		if (dia <= 750) return 2;
		if (dia <= 1000) return 1;
		if (dia <= 1500) return 0.5;
		if (dia <= 1800) return 0.33;
		return 0.25;
	}

	// ─── STYLES ──────────────────────────────────────────
	setup_styles() {
		if ($('#project-estimator-style').length) return;
		$(`<style id="project-estimator-style">
			.zenova-estimator{--blue:#1a3a5c;--accent:#e8a020;--light:#f4f7fb;--border:#d0dbe8;--green:#1e7e34;--red:#c0392b;--card:#fff;--text:#1a2332;--sub:#5a6a7a;--mob:#6f42c1;
				font-family:'Segoe UI',Arial,sans-serif;background:var(--light);color:var(--text);padding:16px;border-radius:8px;}
			.zenova-estimator *{box-sizing:border-box;}
			.zenova-estimator .tabs{background:#122a45;display:flex;padding:0 14px;border-radius:8px 8px 0 0;}
			.zenova-estimator .tab-btn{padding:12px 22px;color:#aabcd0;font-size:13px;font-weight:600;cursor:pointer;border:none;background:none;border-bottom:3px solid transparent;transition:all .18s;}
			.zenova-estimator .tab-btn.active{color:var(--accent);border-bottom-color:var(--accent);}
			.zenova-estimator .pe-page{display:none;max-width:1180px;margin:20px auto 0;padding:0 4px;}
			.zenova-estimator .pe-page.active{display:block;}
			.zenova-estimator .card{background:var(--card);border-radius:13px;box-shadow:0 2px 14px rgba(26,58,92,.08);padding:20px;border:1px solid var(--border);margin-bottom:18px;}
			.zenova-estimator .card-title{font-size:14px;font-weight:700;color:var(--blue);margin-bottom:15px;display:flex;align-items:center;gap:8px;border-bottom:2px solid var(--accent);padding-bottom:9px;}
			.zenova-estimator .card-title.mob-title{border-bottom-color:var(--mob);}
			.zenova-estimator .card-title.mp-title{border-bottom-color:var(--green);}
			.zenova-estimator .form-group{margin-bottom:12px;}
			.zenova-estimator label{display:block;font-size:11.5px;font-weight:600;color:var(--sub);margin-bottom:4px;}
			.zenova-estimator input[type="number"],.zenova-estimator input[type="text"],.zenova-estimator select,.zenova-estimator textarea{width:100%;border:1.5px solid var(--border);border-radius:7px;padding:8px 11px;font-size:13.5px;color:var(--text);background:#fff;transition:border .2s;outline:none;}
			.zenova-estimator input:focus,.zenova-estimator select:focus,.zenova-estimator textarea:focus{border-color:var(--blue);}
			.zenova-estimator textarea{resize:vertical;min-height:55px;}
			.zenova-estimator .row2{display:grid;grid-template-columns:1fr 1fr;gap:11px;}
			.zenova-estimator .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;}
			.zenova-estimator .row4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:9px;}
			.zenova-estimator .sec-label{font-size:10.5px;font-weight:700;color:var(--accent);letter-spacing:1px;text-transform:uppercase;margin:14px 0 9px;}
			.zenova-estimator .sec-label.mob{color:var(--mob);}
			.zenova-estimator .sec-label.mp{color:var(--green);}
			.zenova-estimator .h-row{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px;}
			.zenova-estimator .h-btn{flex:1;min-width:65px;border:1.5px solid var(--border);border-radius:7px;padding:6px 7px;font-size:11px;font-weight:600;cursor:pointer;background:#fff;color:var(--sub);transition:all .18s;text-align:center;}
			.zenova-estimator .h-btn.active{background:var(--blue);color:#fff;border-color:var(--blue);}
			.zenova-estimator .worker-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:4px;}
			.zenova-estimator .worker-table th{background:#eef3fa;color:var(--blue);padding:8px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.3px;}
			.zenova-estimator .worker-table td{padding:6px 10px;border-bottom:1px solid var(--border);}
			.zenova-estimator .worker-table tr:last-child td{border-bottom:none;}
			.zenova-estimator .worker-table input[type="number"]{width:70px;padding:5px 8px;font-size:13px;text-align:center;}
			.zenova-estimator .worker-badge{display:inline-block;background:var(--green);color:#fff;border-radius:12px;padding:2px 9px;font-size:11px;font-weight:700;margin-left:8px;}
			.zenova-estimator .mob-box{background:#f3eeff;border-left:4px solid var(--mob);border-radius:7px;padding:12px 15px;font-size:12.5px;line-height:1.9;margin-top:10px;}
			.zenova-estimator .mob-box b{color:var(--mob);}
			.zenova-estimator .btn{padding:10px 20px;border:none;border-radius:8px;font-size:13.5px;font-weight:700;cursor:pointer;transition:all .18s;}
			.zenova-estimator .btn-primary{background:var(--accent);color:var(--blue);}
			.zenova-estimator .btn-primary:hover{background:#d4911a;}
			.zenova-estimator .btn-dark{background:var(--blue);color:#fff;}
			.zenova-estimator .btn-dark:hover{background:#122a45;}
			.zenova-estimator .btn-success{background:var(--green);color:#fff;}
			.zenova-estimator .btn-success:hover{background:#166128;}
			.zenova-estimator .btn-sm{padding:6px 13px;font-size:12px;}
			.zenova-estimator .btn-full{width:100%;margin-top:10px;}
			.zenova-estimator .btn-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;}
			@media(max-width:800px){
				.zenova-estimator .row2,.zenova-estimator .row3,.zenova-estimator .row4{grid-template-columns:1fr;}
				.zenova-estimator .inputs-grid{grid-template-columns:1fr!important;}
			}
			.zenova-estimator .scope-box{background:#eef3fa;border-left:4px solid var(--accent);border-radius:7px;padding:12px 16px;margin-bottom:15px;font-size:12.5px;line-height:1.9;}
			.zenova-estimator .alert{padding:10px 13px;border-radius:7px;font-size:13px;margin-bottom:12px;}
			.zenova-estimator .alert.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb;}
			.zenova-estimator .alert.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;}
			.zenova-estimator .empty{text-align:center;padding:50px 20px;color:var(--sub);}
			.zenova-estimator .empty .ico{font-size:46px;margin-bottom:10px;}
			@media print{
				.zenova-estimator .no-print,.zenova-estimator .tabs,.zenova-estimator .inputs-grid,.zenova-estimator .btn-row{display:none!important;}
				.zenova-estimator .pe-page{display:none !important;max-width:100%;margin:0;padding:0;}
				.zenova-estimator .pe-page.active{display:block !important;}
				.zenova-estimator #pe_resultArea{width:100% !important;display:block !important;}
				.zenova-estimator .card{break-inside:avoid;box-shadow:none !important;border:1px solid #ddd !important;}
			}
		</style>`).appendTo('head');
	}

	// ─── MARKUP ──────────────────────────────────────────
	render() {
		this.$container.html(`
		<div class="zenova-estimator">
			<div class="tabs no-print">
				<button class="tab-btn active" data-tab="calc">⚡ Calculate Quote</button>
				<button class="tab-btn" data-tab="history">📁 Quote History</button>
			</div>

			<div class="pe-page active" id="pe_page_calc">
				<div class="inputs-grid" style="display:grid;grid-template-columns:400px 1fr;gap:22px;align-items:start;">
					<div>
						<div class="card">
							<div class="card-title"><span>📋</span> 1 · Project & Scope</div>
							<div class="row2">
								<div class="form-group"><label>Client Name</label><input type="text" id="pe_clientName" placeholder="e.g. Samsung C&T"/></div>
								<div class="form-group"><label>Project Reference</label><input type="text" id="pe_projectRef" placeholder="e.g. LTA-DTL3 P103"/></div>
							</div>
							<div class="row3">
								<div class="form-group"><label>No. of Holes</label><input type="number" id="pe_numHoles" value="10" min="1"/></div>
								<div class="form-group"><label>Diameter (mm)</label>
									<select id="pe_diameter">
										<option value="100">100mm</option><option value="150">150mm</option>
										<option value="200">200mm</option><option value="300">300mm</option>
										<option value="400">400mm</option><option value="500">500mm</option>
										<option value="600" selected>600mm</option><option value="750">750mm</option>
										<option value="900">900mm</option><option value="1000">1000mm</option>
										<option value="1200">1200mm</option><option value="1500">1500mm</option><option value="1600">1600mm</option><option value="1700">1700mm</option><option value="1800">1800mm</option><option value="1900">1900mm</option><option value="2000">2000mm</option>
									</select>
								</div>
								<div class="form-group"><label>Depth (m/hole)</label><input type="number" id="pe_depth" value="3" min="0.5" step="0.5"/></div>
							</div>
							<div class="sec-label">Concrete Hardness</div>
							<div class="h-row">
								<div class="h-btn" data-val="1.0">Normal<br><small>×1.0</small></div>
								<div class="h-btn active" data-val="1.2">Reinforced<br><small>×1.2</small></div>
								<div class="h-btn" data-val="1.5">High Grade<br><small>×1.5</small></div>
								<div class="h-btn" data-val="2.0">Pile Cap<br><small>×2.0</small></div>
							</div>
						</div>

						<div class="card">
							<div class="card-title mob-title"><span>🚚</span> 2 · Mobilisation Schedule</div>
							<div class="form-group">
								<label>Mobilisation Cost Rate (SGD/day)</label>
								<input type="number" id="pe_mobRate" value="10000" min="0"/>
							</div>
							<div class="row3">
								<div class="form-group"><label>Mob Days</label><input type="number" id="pe_mobDays" value="1" min="0"/></div>
								<div class="form-group"><label>Demob Days</label><input type="number" id="pe_demobDays" value="1" min="0"/></div>
								<div class="form-group"><label>Total Mob Days</label><input type="number" id="pe_totalMobPreview" value="2" readonly style="background:#f4f7fb;font-weight:700;color:var(--mob);"/></div>
							</div>
							<div class="sec-label mob">⏱ Coring Point Schedule (Engineer Input)</div>
							<div class="row2">
								<div class="form-group">
									<label>Days Per Coring Point</label>
									<input type="number" id="pe_daysPerPoint" value="0" min="0" step="0.5" placeholder="0 = auto"/>
									<div style="font-size:11px;color:var(--sub);margin-top:4px;">Set 0 to use diameter-based auto rate. E.g. 1.5 = 1.5 days per hole.</div>
								</div>
								<div class="form-group">
									<label>Est. Coring Work Days</label>
									<input type="number" id="pe_coringDaysPreview" value="—" readonly style="background:#f4f7fb;font-weight:700;color:var(--blue);"/>
								</div>
							</div>
							<div style="margin-top:10px;">
								<div style="font-size:11px;font-weight:700;color:var(--mob);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">📦 Equipment Mob Premiums (auto from Section 3)</div>
								<div class="row2" style="margin-bottom:8px;">
									<div style="background:#f3eeff;border-radius:7px;padding:9px 12px;font-size:12.5px;">
										🏗 Crane: <b id="pe_craneMobLabel">—</b><br>
										<span style="font-size:11px;color:var(--sub);" id="pe_craneMobSub">Select crane above</span>
									</div>
									<div style="background:#e8f4fd;border-radius:7px;padding:9px 12px;font-size:12.5px;">
										🔩 Rotator: <b id="pe_rotatorMobLabel">—</b><br>
										<span style="font-size:11px;color:var(--sub);" id="pe_rotatorMobSub">Select rotator above</span>
									</div>
								</div>
							</div>
							<div class="mob-box" id="pe_mobPreviewBox">
								<b>📅 Schedule Preview</b><br>
								Fill in the fields above to see the mobilisation schedule.
							</div>
						</div>

						<div class="card">
							<div class="card-title"><span>🏗️</span> 3 · Machinery Selection & Daily Rates (SGD)</div>
							<div class="sec-label">🏗 Crane Model</div>
							<div class="form-group">
								<label>Select Crane</label>
								<select id="pe_craneModel">
									<option value="custom|0|0">— Custom / Enter manually —</option>
									<option value="90T Crawler Crane|800|15000" selected>90T Crawler Crane — $800/day (+$15,000 mob)</option>
									<option value="TK750 Crawler Crane|1000|5000">TK750 Crawler Crane — $1,000/day (+$5,000 mob)</option>
									<option value="7120GFS Crawler Crane|1000|15000">7120GFS Crawler Crane — $1,000/day (+$15,000 mob)</option>
								</select>
							</div>
							<div class="row2">
								<div class="form-group">
									<label>Crane Daily Rate (SGD)</label>
									<input type="number" id="pe_craneRate" value="800"/>
								</div>
								<div class="form-group">
									<label>Crane Mob Premium</label>
									<input type="number" id="pe_craneMobPremium" value="15000" readonly style="background:#f4f7fb;font-weight:700;color:var(--mob);"/>
								</div>
							</div>
							<div class="sec-label" style="color:#0077b6;">🔩 Rotator / Coring Rig Model</div>
							<div class="form-group">
								<label>Select Rotator</label>
								<select id="pe_rotatorModel">
									<option value="custom|0|0">— Custom / Enter manually —</option>
									<option value="RT150|1000|3000" selected>RT150 — $1,000/day (+$3,000 mob)</option>
									<option value="RT200|1500|3000">RT200 — $1,500/day (+$3,000 mob)</option>
									<option value="RT210C|1200|12000">RT210C — $1,200/day (+$12,000 mob)</option>
								</select>
							</div>
							<div class="row2">
								<div class="form-group">
									<label>Rotator Daily Rate (SGD)</label>
									<input type="number" id="pe_coringRigRate" value="1000"/>
								</div>
								<div class="form-group">
									<label>Rotator Mob Premium</label>
									<input type="number" id="pe_rotatorMobPremium" value="3000" readonly style="background:#f4f7fb;font-weight:700;color:#0077b6;"/>
								</div>
							</div>
							<div class="row2">
								<div class="form-group"><label>Excavator (w/ Breaker) — SGD/day</label><input type="number" id="pe_excavatorRate" value="800"/></div>
								<div class="form-group"><label>Generator & Water Truck — SGD/day</label><input type="number" id="pe_generatorRate" value="400"/></div>
							</div>
							<div class="form-group"><label>Diamond Bit Consumable ($/linear metre)</label><input type="number" id="pe_consumableRate" value="120" step="5"/></div>
						</div>

						<div class="card">
							<div class="card-title mp-title"><span>👷</span> 4 · Worker Allocation <span id="pe_totalWorkerBadge" class="worker-badge">11 workers</span></div>
							<div style="font-size:12px;color:var(--sub);margin-bottom:10px;">Set the number of workers per role. Defaults shown are LTA minimum. Adjust to match your deployment.</div>
							<table class="worker-table">
								<thead><tr><th>Role</th><th>Daily Rate</th><th>Workers</th><th class="r">Daily Cost</th></tr></thead>
								<tbody id="pe_workerTableBody"></tbody>
								<tfoot>
									<tr style="background:#eef3fa;font-weight:700;">
										<td colspan="2" style="padding:8px 10px;color:var(--blue);">TOTAL</td>
										<td style="padding:8px 10px;"><span id="pe_footTotalWorkers" style="font-weight:800;color:var(--green);">11</span></td>
										<td class="r" style="padding:8px 10px;color:var(--blue);" id="pe_footDailyCost">—</td>
									</tr>
								</tfoot>
							</table>
						</div>

						<div class="card">
							<div class="card-title"><span>📋</span> 5 · LTA Compliance Costs</div>
							<div class="row2">
								<div class="form-group"><label>PE Lifting Plan (lump sum)</label><input type="number" id="pe_pePlanRate" value="2500"/></div>
								<div class="form-group"><label>PTW Management/day</label><input type="number" id="pe_ptwRate" value="150"/></div>
							</div>
							<div class="row2">
								<div class="form-group"><label>Noise/Vib Monitor/day</label><input type="number" id="pe_noiseRate" value="200"/></div>
								<div class="form-group"><label>Waste Management/day</label><input type="number" id="pe_wasteRate" value="500"/></div>
							</div>
							<div class="row2">
								<div class="form-group"><label>NCE (lump sum)</label><input type="number" id="pe_nceRate" value="0"/></div>
								<div class="form-group"><label>Impact Assessment (lump sum)</label><input type="number" id="pe_impactRate" value="0"/></div>
							</div>
							<div class="row2">
								<div class="form-group"><label>PE Calculation (lump sum)</label><input type="number" id="pe_peCalcRate" value="0"/></div>
								<div class="form-group"></div>
							</div>
							<div style="margin-top:10px;border-top:1px solid #e0e7ef;padding-top:12px;">
								<div style="font-size:12px;font-weight:700;color:var(--blue);margin-bottom:8px;">Additional Compliance Items</div>
								<div id="pe_extraComplianceRows"></div>
								<button type="button" class="btn btn-dark btn-sm" style="margin-top:6px;" id="pe_addComplianceBtn">＋ Add Item</button>
							</div>
						</div>

						<div class="card">
							<div class="card-title"><span>⛽</span> 6 · Overhead & Diesel</div>
							<div class="row2">
								<div class="form-group">
									<label>Overhead (% of Labour + Machinery)</label>
									<input type="number" id="pe_overheadPct" value="0" min="0" step="0.5"/>
								</div>
								<div class="form-group">
									<label>Overhead Lump Sum (S$) <span style="font-size:11px;color:var(--sub)">optional, added on top</span></label>
									<input type="number" id="pe_overheadLump" value="0" min="0"/>
								</div>
							</div>
							<div class="row2">
								<div class="form-group">
									<label>Diesel Rate (S$/Litre)</label>
									<input type="number" id="pe_dieselRate" value="1.80" min="0" step="0.01"/>
								</div>
								<div class="form-group">
									<label>Diesel Consumption (Litres/Day)</label>
									<input type="number" id="pe_dieselLitres" value="0" min="0"/>
								</div>
							</div>
						</div>

						<div class="card">
							<div class="card-title"><span>📊</span> 7 · Margins & Notes</div>
							<div class="row2">
								<div class="form-group"><label>Profit Margin (%)</label><input type="number" id="pe_profitPct" value="15"/></div>
								<div class="form-group"><label>Contingency (%)</label><input type="number" id="pe_contingencyPct" value="10"/></div>
							</div>
							<div class="form-group"><label>Notes</label><textarea id="pe_notes" placeholder="Additional remarks..."></textarea></div>
						</div>

						<button class="btn btn-primary btn-full" id="pe_calcBtn">⚡ Calculate Quotation</button>
					</div>

					<div id="pe_resultArea">
						<div class="empty">
							<div class="ico">🔧</div>
							<div style="font-size:15px;font-weight:700;color:var(--blue);">Fill in parameters and click Calculate</div>
							<div style="font-size:13px;margin-top:7px;">A summary of the collected project data will appear here, ready to save</div>
						</div>
					</div>
				</div>
			</div>

			<div class="pe-page" id="pe_page_history">
				<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
					<div style="font-size:17px;font-weight:700;color:var(--blue);">📁 Saved Quotations</div>
					<button class="btn btn-dark btn-sm" id="pe_refreshHistoryBtn">🔄 Refresh</button>
				</div>
				<div id="pe_historyList"><div class="empty"><div class="ico">⏳</div><div>Loading...</div></div></div>
			</div>
		</div>
		`);
	}

	// ─── EVENTS ──────────────────────────────────────────
	bind_static_events() {
		const me = this;
		const $c = this.$container;

		$c.on('click', '.tab-btn', function () {
			me.show_tab($(this).data('tab'), this);
		});

		$c.on('click', '.h-btn', function () {
			me.set_hardness(this);
		});

		$c.on('input', '#pe_numHoles, #pe_daysPerPoint, #pe_mobDays, #pe_demobDays, #pe_craneRate, #pe_coringRigRate, #pe_overheadPct, #pe_overheadLump, #pe_dieselRate, #pe_dieselLitres', function () {
			me.update_worker_footer();
			me.update_mob_preview();
			if (me.last_inputs) me.calculate();
		});

		$c.on('change', '#pe_diameter', function () {
			me.update_mob_preview();
			if (me.last_inputs) me.calculate();
		});

		$c.on('change', '#pe_craneModel', function () { me.on_crane_change(); });
		$c.on('change', '#pe_rotatorModel', function () { me.on_rotator_change(); });

		$c.on('input', '[id^="pe_wc_"]', function () {
			me.update_worker_table();
		});

		$c.on('click', '#pe_addComplianceBtn', function () { me.add_compliance_row(); });

		$c.on('click', '.pe-remove-compliance', function () {
			$('#' + $(this).data('row')).remove();
		});

		$c.on('click', '#pe_calcBtn', function () { me.calculate(); });

		$c.on('click', '#pe_refreshHistoryBtn', function () { me.load_history(); });

		$c.on('click', '.pe-save-quote', function () { me.save_quote(); });
		$c.on('click', '.pe-print-quote', function () { me.print_quote(); });
	}

	show_tab(tab, btn) {
		this.$container.find('.pe-page').removeClass('active');
		this.$container.find('.tab-btn').removeClass('active');
		this.$container.find('#pe_page_' + tab).addClass('active');
		$(btn).addClass('active');
		if (tab === 'history') this.load_history();
	}

	set_hardness(btn) {
		this.$container.find('.h-btn').removeClass('active');
		$(btn).addClass('active');
		this.hardness_factor = parseFloat($(btn).data('val'));
	}

	// ─── WORKER TABLE ────────────────────────────────────
	build_worker_table() {
		const tbody = this.el('pe_workerTableBody');
		if (!tbody) return;
		let rows = '';
		this.roles.forEach(r => {
			const key = r.name.replace(/ /g, '_');
			const dailyCost = (r.rate * r.def).toLocaleString();
			rows += `<tr>
				<td style="font-weight:600">${r.name}</td>
				<td style="color:var(--sub)">$${r.rate}/day</td>
				<td><input type="number" id="pe_wc_${key}" value="${r.def}" min="0" max="20" style="width:70px;text-align:center;padding:5px 7px;font-size:13px;border:1px solid #cdd8e8;border-radius:5px;"/></td>
				<td class="r" id="pe_wd_${key}">$${dailyCost}</td>
			</tr>`;
		});
		tbody.innerHTML = rows;
		this.update_worker_footer();
	}

	update_worker_table() {
		this.update_worker_footer();
		this.update_mob_preview();
		if (this.last_inputs) this.calculate();
	}

	update_worker_footer() {
		let total = 0, daily = 0;
		this.roles.forEach(r => {
			const key = r.name.replace(/ /g, '_');
			const cnt = parseInt(this.val('pe_wc_' + key)) || 0;
			const cost = r.rate * cnt;
			total += cnt;
			daily += cost;
			const cell = this.el('pe_wd_' + key);
			if (cell) cell.textContent = '$' + cost.toLocaleString();
		});
		this.el('pe_footTotalWorkers').textContent = total;
		this.el('pe_footDailyCost').textContent = this.fmt(daily);
		this.el('pe_totalWorkerBadge').textContent = total + ' workers';
	}

	// ─── EXTRA COMPLIANCE ROWS ───────────────────────────
	add_compliance_row() {
		this.extra_compliance_count++;
		const domId = 'pe_extra_' + this.extra_compliance_count;
		const rowId = 'pe_row_' + domId;
		const row = document.createElement('div');
		row.className = 'row2';
		row.id = rowId;
		row.style = 'align-items:center;gap:8px;margin-bottom:6px;';
		row.innerHTML = `
			<div class="form-group" style="flex:2"><input type="text" id="pe_lbl_${domId}" placeholder="Item name e.g. Survey Report" style="width:100%"/></div>
			<div class="form-group" style="flex:1"><input type="number" id="pe_amt_${domId}" placeholder="Amount (SGD)" style="width:100%"/></div>
			<button type="button" class="pe-remove-compliance" data-row="${rowId}" style="background:#e74c3c;color:#fff;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:13px;">✕</button>
		`;
		this.el('pe_extraComplianceRows').appendChild(row);
	}

	get_extra_compliance_items() {
		const items = [];
		this.$container.find('[id^="pe_lbl_extra_"]').each((_, el) => {
			const idx = el.id.replace('pe_lbl_', '');
			const amtEl = this.el('pe_amt_' + idx);
			if (el.value.trim() && amtEl && parseFloat(amtEl.value) > 0) {
				items.push({ label: el.value.trim(), amount: parseFloat(amtEl.value) });
			}
		});
		return items;
	}

	// ─── MOB PREVIEW ─────────────────────────────────────
	get_equipment_mob_premiums() {
		const cranePremium = parseFloat(this.val('pe_craneMobPremium')) || 0;
		const rotatorPremium = parseFloat(this.val('pe_rotatorMobPremium')) || 0;
		return cranePremium + rotatorPremium;
	}

	update_mob_preview() {
		const mob = parseInt(this.val('pe_mobDays')) || 0;
		const demob = parseInt(this.val('pe_demobDays')) || 0;
		const mobRate = parseFloat(this.val('pe_mobRate')) || 0;
		const dpp = parseFloat(this.val('pe_daysPerPoint')) || 0;
		const holes = parseInt(this.val('pe_numHoles')) || 1;
		const dia = parseInt(this.val('pe_diameter')) || 600;

		this.el('pe_totalMobPreview').value = mob + demob;

		const hpd = this.holes_per_day(dia);
		const coringDays = dpp > 0 ? Math.ceil(holes * dpp) : Math.ceil(holes / hpd);
		this.el('pe_coringDaysPreview').value = coringDays;

		const totalDays = coringDays + mob + demob;
		const baseMobCost = (mob + demob) * mobRate;
		const equipPremium = this.get_equipment_mob_premiums();
		const totalMobCost = baseMobCost + equipPremium;
		const rateLabel = dpp > 0 ? `${dpp} day(s)/hole (engineer-defined)` : `${hpd >= 1 ? hpd + ' holes/day' : (1 / hpd) + ' days/hole'} (diameter auto)`;

		this.el('pe_mobPreviewBox').innerHTML = `
			<b>📅 Mobilisation Schedule</b><br>
			▸ Mobilisation: <b>${mob} day(s)</b> — LTA site induction, security clearance, equipment deployment<br>
			▸ Coring Works: <b>${coringDays} days</b> @ ${rateLabel}<br>
			▸ Demobilisation: <b>${demob} day(s)</b> — Equipment removal & site reinstatement<br>
			▸ <b>Total Project Duration: ${totalDays} days</b><br>
			▸ Base Mob/Demob: <b>${this.fmt(baseMobCost)}</b> ($${mobRate.toLocaleString()}/day × ${mob + demob} days)<br>
			▸ Equipment Premiums: <b>${this.fmt(equipPremium)}</b> (crane + rotator mob costs)<br>
			▸ <b>Total Mob Cost: ${this.fmt(totalMobCost)}</b>
		`;
	}

	// ─── CRANE & ROTATOR SELECTORS ───────────────────────
	on_crane_change() {
		const sel = this.val('pe_craneModel');
		const [name, rate, mob] = sel.split('|');
		const isCustom = name === 'custom';
		const rateEl = this.el('pe_craneRate');
		rateEl.value = isCustom ? '' : rate;
		rateEl.readOnly = !isCustom;
		rateEl.style.background = isCustom ? '#fff' : '#f4f7fb';
		this.el('pe_craneMobPremium').value = isCustom ? 0 : mob;
		this.el('pe_craneMobLabel').textContent = isCustom ? 'Custom (no premium)' : '$' + Number(mob).toLocaleString();
		this.el('pe_craneMobSub').textContent = isCustom ? 'Enter rate manually' : name + ' — $' + Number(rate).toLocaleString() + '/day';
		this.update_mob_preview();
	}

	on_rotator_change() {
		const sel = this.val('pe_rotatorModel');
		const [name, rate, mob] = sel.split('|');
		const isCustom = name === 'custom';
		const rateEl = this.el('pe_coringRigRate');
		rateEl.value = isCustom ? '' : rate;
		rateEl.readOnly = !isCustom;
		rateEl.style.background = isCustom ? '#fff' : '#f4f7fb';
		this.el('pe_rotatorMobPremium').value = isCustom ? 0 : mob;
		this.el('pe_rotatorMobLabel').textContent = isCustom ? 'Custom (no premium)' : '$' + Number(mob).toLocaleString();
		this.el('pe_rotatorMobSub').textContent = isCustom ? 'Enter rate manually' : name + ' — $' + Number(rate).toLocaleString() + '/day';
		this.update_mob_preview();
	}

	get_crane_model_name() {
		const name = this.val('pe_craneModel').split('|')[0];
		return name === 'custom' ? 'Custom Crane' : name;
	}

	get_rotator_model_name() {
		const name = this.val('pe_rotatorModel').split('|')[0];
		return name === 'custom' ? 'Custom Rotator' : name;
	}

	// ─── READ INPUTS ─────────────────────────────────────
	get_inputs() {
		const worker_counts = {};
		this.roles.forEach(r => {
			const key = r.name.replace(/ /g, '_');
			worker_counts[r.name] = parseInt(this.val('pe_wc_' + key)) || 0;
		});
		return {
			client_name: this.val('pe_clientName'),
			project_ref: this.val('pe_projectRef'),
			num_holes: parseInt(this.val('pe_numHoles')) || 1,
			diameter_mm: parseInt(this.val('pe_diameter')),
			depth_m: parseFloat(this.val('pe_depth')) || 1,
			hardness_factor: this.hardness_factor,
			days_per_coring_point: parseFloat(this.val('pe_daysPerPoint')) || 0,
			mob_days: parseInt(this.val('pe_mobDays')) || 0,
			demob_days: parseInt(this.val('pe_demobDays')) || 0,
			mob_rate: parseFloat(this.val('pe_mobRate')) || 0,
			crane_rate: parseFloat(this.val('pe_craneRate')) || 0,
			excavator_rate: parseFloat(this.val('pe_excavatorRate')) || 0,
			coring_rig_rate: parseFloat(this.val('pe_coringRigRate')) || 0,
			generator_rate: parseFloat(this.val('pe_generatorRate')) || 0,
			consumable_rate: parseFloat(this.val('pe_consumableRate')) || 0,
			profit_pct: parseFloat(this.val('pe_profitPct')) || 0,
			contingency_pct: parseFloat(this.val('pe_contingencyPct')) || 10,
			pe_plan_rate: parseFloat(this.val('pe_pePlanRate')) || 0,
			ptw_rate: parseFloat(this.val('pe_ptwRate')) || 0,
			noise_rate: parseFloat(this.val('pe_noiseRate')) || 0,
			waste_rate: parseFloat(this.val('pe_wasteRate')) || 0,
			nce_rate: parseFloat(this.val('pe_nceRate')) || 0,
			impact_rate: parseFloat(this.val('pe_impactRate')) || 0,
			pe_calc_rate: parseFloat(this.val('pe_peCalcRate')) || 0,
			extra_compliance: this.get_extra_compliance_items(),
			notes: this.val('pe_notes'),
			overhead_pct: parseFloat(this.val('pe_overheadPct')) || 0,
			overhead_lump: parseFloat(this.val('pe_overheadLump')) || 0,
			diesel_rate: parseFloat(this.val('pe_dieselRate')) || 0,
			diesel_litres: parseFloat(this.val('pe_dieselLitres')) || 0,
			worker_counts,
			crane_model: this.get_crane_model_name(),
			rotator_model: this.get_rotator_model_name(),
			crane_mob_premium: parseFloat(this.val('pe_craneMobPremium')) || 0,
			rotator_mob_premium: parseFloat(this.val('pe_rotatorMobPremium')) || 0,
		};
	}

	// ─── CALCULATE ───────────────────────────────────────
	// This collects the form into a plain object and previews it. Wire the
	// "Save Quote to Database" button below to a frappe.call() once the
	// Coring Quotation doctype exists, passing `this.last_inputs` as the
	// document to insert.
	calculate() {
		const inp = this.get_inputs();
		this.last_inputs = inp;
		this.render_preview(inp);
	}

	// ─── PREVIEW ──────────────────────────────────────────
	render_preview(inp) {
		const total_lm = inp.num_holes * inp.depth_m;
		const total_workers = Object.values(inp.worker_counts).reduce((a, b) => a + b, 0);

		let html = '';

		html += `<div class="card">
			<div class="card-title"><span>📋</span> Project Scope Summary</div>
			<div class="scope-box">
				<b>Client:</b> ${frappe.utils.escape_html(inp.client_name || '—')} &nbsp;|&nbsp; <b>Project:</b> ${frappe.utils.escape_html(inp.project_ref || '—')}<br>
				<b>Scope:</b> ${inp.num_holes} core holes · Ø${inp.diameter_mm}mm · ${inp.depth_m}m/hole · ${total_lm} linear metres total<br>
				<b>Hardness:</b> ×${inp.hardness_factor} &nbsp;|&nbsp; <b>Mob/Demob:</b> ${inp.mob_days}/${inp.demob_days} day(s)<br>
				<b>Crane:</b> ${frappe.utils.escape_html(inp.crane_model)} &nbsp;|&nbsp; <b>Rotator:</b> ${frappe.utils.escape_html(inp.rotator_model)}<br>
				<b>Total Workers:</b> ${total_workers}
			</div>
		</div>`;

		html += `<div class="card">
			<div class="card-title"><span>🗂️</span> Collected Form Data</div>
			<div style="font-size:12px;color:var(--sub);margin-bottom:10px;">This is the payload that will be saved once this page is wired up to a database doctype.</div>
			<pre style="background:#0f2a44;color:#dce9f7;padding:14px;border-radius:8px;font-size:12px;line-height:1.5;overflow:auto;max-height:420px;">${frappe.utils.escape_html(JSON.stringify(inp, null, 2))}</pre>
			<div class="btn-row no-print">
				<button class="btn btn-success pe-save-quote">💾 Save Quote to Database</button>
				<button class="btn btn-dark pe-print-quote">🖨️ Print</button>
			</div>
			<div id="pe_saveMsg"></div>
		</div>`;

		this.el('pe_resultArea').innerHTML = html;
	}

	// ─── PRINT QUOTE ──────────────────────────────────
	print_quote() {
		const result = this.el('pe_resultArea');
		if (result) result.scrollIntoView();
		setTimeout(() => window.print(), 150);
	}

	// ─── SAVE QUOTE ───────────────────────────────────
	// TODO: once a "Coring Quotation" (or similar) doctype is created, replace
	// the local JSON download below with a frappe.call() that inserts a
	// document built from `this.last_inputs`.
	save_quote() {
		if (!this.last_inputs) return;
		const ref = 'PE-QT-' + frappe.datetime.now_datetime().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100);
		const data = Object.assign({ quote_ref: ref, generated: frappe.datetime.now_datetime() }, this.last_inputs);
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = ref + '.json';
		a.click();
		this.el('pe_saveMsg').innerHTML = `<div class="alert success" style="margin-top:12px;">✅ Quote data downloaded: <b>${ref}</b> — ready to wire into a doctype save.</div>`;
	}

	// ─── HISTORY (placeholder until doctype integration) ─
	load_history() {
		this.el('pe_historyList').innerHTML = `<div class="empty">
			<div class="ico">💾</div>
			<div style="font-weight:700;color:var(--blue);margin-bottom:8px">Quote history not connected yet</div>
			<div style="font-size:13px;color:var(--sub)">Once quotes are saved to a database doctype, they will be listed here.<br>For now, use the 💾 Save button to download a JSON copy of each quote.</div>
		</div>`;
	}
};
