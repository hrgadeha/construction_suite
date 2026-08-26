# Copyright (c) 2026, Hardik Gadesha and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt


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
		actual_amount = get_actual_expense(budget, project)
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


def get_actual_expense(budget, project):
	start_date = frappe.get_cached_value("Fiscal Year", budget.from_fiscal_year, "year_start_date")
	end_date = frappe.get_cached_value("Fiscal Year", budget.to_fiscal_year, "year_end_date")

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
