# Copyright (c) 2026, Hardik Gadesha and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt

VOUCHER_ITEM_TABLES = {
	"Purchase Invoice": {"doctype": "Purchase Invoice Item", "account_field": "expense_account", "rate_field": "rate"},
	"Purchase Receipt": {"doctype": "Purchase Receipt Item", "account_field": "expense_account", "rate_field": "rate"},
	"Stock Entry": {"doctype": "Stock Entry Detail", "account_field": "expense_account", "rate_field": "basic_rate"},
	"Expense Claim": {
		"doctype": "Expense Claim Detail",
		"account_field": "default_account",
		"rate_field": "amount",
		"item_field": "expense_type",
	},
}


@frappe.whitelist()
def get_project_budget_summary(project):
	frappe.has_permission("Budget", ptype="read", throw=True)

	budgets = frappe.get_all(
		"Budget",
		filters={"project": project, "docstatus": 1},
		fields=["name", "account", "budget_amount", "company", "from_fiscal_year", "to_fiscal_year"],
	)

	rows = []
	for budget in budgets:
		start_date, end_date = get_fiscal_year_range(budget.from_fiscal_year, budget.to_fiscal_year)
		actual_amount = get_actual_expense(budget, project, start_date, end_date)
		rows.append(
			{
				"name": budget.name,
				"account": budget.account,
				"budget_amount": flt(budget.budget_amount),
				"actual_amount": actual_amount,
				"remaining_amount": flt(budget.budget_amount) - actual_amount,
			}
		)

	return rows


@frappe.whitelist()
def get_budget_transactions(budget):
	if not frappe.has_permission("Budget", ptype="read", doc=budget):
		frappe.throw(_("Not permitted to view {0}").format(budget), frappe.PermissionError)
	frappe.has_permission("GL Entry", ptype="read", throw=True)

	budget_doc = frappe.db.get_value(
		"Budget",
		budget,
		["account", "project", "company", "from_fiscal_year", "to_fiscal_year"],
		as_dict=True,
	)
	if not budget_doc:
		frappe.throw(_("Budget {0} not found").format(budget))

	start_date, end_date = get_fiscal_year_range(budget_doc.from_fiscal_year, budget_doc.to_fiscal_year)

	vouchers = frappe.db.sql(
		"""
		select voucher_type, voucher_no, posting_date, party_type, party, remarks,
			sum(debit) - sum(credit) as amount
		from `tabGL Entry`
		where
			account = %(account)s
			and project = %(project)s
			and company = %(company)s
			and is_cancelled = 0
			and docstatus = 1
			and posting_date between %(start_date)s and %(end_date)s
		group by voucher_type, voucher_no
		order by posting_date desc, voucher_no desc
		""",
		{
			"account": budget_doc.account,
			"project": budget_doc.project,
			"company": budget_doc.company,
			"start_date": start_date,
			"end_date": end_date,
		},
		as_dict=True,
	)

	line_items_by_voucher = get_voucher_line_items(budget_doc.account, budget_doc.project, vouchers)

	rows = []
	for voucher in vouchers:
		line_items = line_items_by_voucher.get((voucher.voucher_type, voucher.voucher_no))
		if line_items:
			for item in line_items:
				rows.append(
					{
						"voucher_type": voucher.voucher_type,
						"voucher_no": voucher.voucher_no,
						"posting_date": voucher.posting_date,
						"party": voucher.party,
						"description": item.item_name or item.item_code,
						"qty": item.qty,
						"uom": item.uom,
						"rate": flt(item.rate),
						"amount": flt(item.amount),
					}
				)
		else:
			rows.append(
				{
					"voucher_type": voucher.voucher_type,
					"voucher_no": voucher.voucher_no,
					"posting_date": voucher.posting_date,
					"party": voucher.party,
					"description": voucher.remarks,
					"qty": None,
					"uom": None,
					"rate": None,
					"amount": flt(voucher.amount),
				}
			)

	return rows


def get_fiscal_year_range(from_fiscal_year, to_fiscal_year):
	start_date = frappe.get_cached_value("Fiscal Year", from_fiscal_year, "year_start_date")
	end_date = frappe.get_cached_value("Fiscal Year", to_fiscal_year, "year_end_date")
	return start_date, end_date


def get_actual_expense(budget, project, start_date, end_date):
	amount = frappe.db.sql(
		"""
		select sum(debit) - sum(credit)
		from `tabGL Entry`
		where
			account = %(account)s
			and project = %(project)s
			and company = %(company)s
			and is_cancelled = 0
			and docstatus = 1
			and posting_date between %(start_date)s and %(end_date)s
		""",
		{
			"account": budget.account,
			"project": project,
			"company": budget.company,
			"start_date": start_date,
			"end_date": end_date,
		},
	)[0][0]

	return flt(amount)


def get_voucher_line_items(account, project, vouchers):
	voucher_nos_by_type = {}
	for voucher in vouchers:
		voucher_nos_by_type.setdefault(voucher.voucher_type, []).append(voucher.voucher_no)

	line_items = {}
	for voucher_type, voucher_nos in voucher_nos_by_type.items():
		config = VOUCHER_ITEM_TABLES.get(voucher_type)
		if not config:
			continue

		filters = {"parent": ["in", voucher_nos], config["account_field"]: account, "project": project}
		if config.get("item_field"):
			fields = ["parent", f"{config['item_field']} as item_name", f"{config['rate_field']} as rate", "amount"]
		else:
			fields = ["parent", "item_code", "item_name", "qty", "uom", f"{config['rate_field']} as rate", "amount"]

		for row in frappe.get_all(config["doctype"], filters=filters, fields=fields):
			if config.get("item_field"):
				row.qty = 1
				row.uom = None
			line_items.setdefault((voucher_type, row.parent), []).append(row)

	return line_items
