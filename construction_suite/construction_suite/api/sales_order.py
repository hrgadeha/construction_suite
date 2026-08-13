# Copyright (c) 2026, Hardik Gadesha and contributors
# For license information, please see license.txt

import json

import frappe
from frappe.utils import escape_html, flt, format_date


def on_submit(doc, method=None):
	if doc.get("project"):
		return

	boq = None
	if doc.get("custom_bill_of_quantities"):
		boq = frappe.get_doc("Bill of Quantities", doc.custom_bill_of_quantities)

	project = create_project_from_sales_order(doc, boq)
	frappe.db.set_value("Sales Order", doc.name, "project", project.name)
	doc.project = project.name

	if boq:
		create_tasks_from_boq_milestones(doc, boq, project)


def create_project_from_sales_order(doc, boq):
	start_date, end_date = get_milestone_date_range(boq) if boq else (None, None)

	project = frappe.get_doc(
		{
			"doctype": "Project",
			"project_name": doc.get("custom_project_name") or doc.customer_name or doc.name,
			"company": doc.company,
			"customer": doc.customer,
			"sales_order": doc.name,
			"expected_start_date": start_date,
			"expected_end_date": end_date,
		}
	)
	project.insert(ignore_permissions=True)
	return project


def get_milestone_date_range(boq):
	start_dates = [row.start_date for row in boq.get("milestones", []) if row.start_date]
	end_dates = [row.end_date for row in boq.get("milestones", []) if row.end_date]
	if not start_dates or not end_dates:
		return None, None
	return min(start_dates), max(end_dates)


def create_tasks_from_boq_milestones(doc, boq, project):
	item_names = get_boq_item_names(boq)

	for milestone in boq.get("milestones", []):
		if not milestone.milestone:
			continue

		task = frappe.get_doc(
			{
				"doctype": "Task",
				"subject": milestone.milestone,
				"project": project.name,
				"company": doc.company,
				"is_milestone": 1,
				"exp_start_date": milestone.start_date,
				"exp_end_date": milestone.end_date,
				"description": build_milestone_task_description(milestone, boq, item_names),
			}
		)
		task.insert(ignore_permissions=True)


def get_boq_item_names(boq):
	item_codes = {row.item_code for row in boq.get("machinery_list", []) if row.item_code}
	item_codes |= {row.item_code for row in boq.get("manpower_list", []) if row.item_code}
	if not item_codes:
		return {}
	rows = frappe.get_all("Item", filters={"name": ["in", list(item_codes)]}, fields=["name", "item_name"])
	return {row.name: row.item_name for row in rows}


def build_milestone_task_description(milestone, boq, item_names):
	machinery_lines = describe_resources(milestone.machinery_json, boq.get("machinery_list", []), item_names)
	manpower_lines = describe_resources(milestone.manpower_json, boq.get("manpower_list", []), item_names)

	total_days = milestone.total_days or 0
	parts = [
		f"<p><strong>Milestone:</strong> {escape_html(milestone.milestone or '')}</p>",
		"<p><strong>Duration:</strong> {0} to {1} ({2} day{3})</p>".format(
			format_date(milestone.start_date) if milestone.start_date else "",
			format_date(milestone.end_date) if milestone.end_date else "",
			total_days,
			"" if total_days == 1 else "s",
		),
		build_resource_list_html("Machinery", machinery_lines),
		build_resource_list_html("Manpower", manpower_lines),
	]
	return "".join(parts)


def describe_resources(codes_json, source_rows, item_names):
	codes = parse_json_list(codes_json)
	rows_by_code = {row.item_code: row for row in source_rows if row.item_code}

	lines = []
	for code in codes:
		row = rows_by_code.get(code)
		name = item_names.get(code, code)
		if row and row.qty:
			lines.append(f"{name} (Qty: {flt(row.qty)})")
		else:
			lines.append(name)
	return lines


def build_resource_list_html(label, lines):
	if not lines:
		return f"<p><strong>{label}:</strong> None assigned</p>"
	items = "".join(f"<li>{escape_html(line)}</li>" for line in lines)
	return f"<p><strong>{label}:</strong></p><ul>{items}</ul>"


def parse_json_list(value):
	if not value:
		return []
	try:
		data = json.loads(value)
	except (TypeError, ValueError):
		return []
	return data if isinstance(data, list) else []