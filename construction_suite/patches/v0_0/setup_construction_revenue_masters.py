# Copyright (c) 2026, Hardik Gadesha and contributors
# For license information, please see license.txt

import frappe

ITEM_GROUP = "Revenue Services"
ITEM_GROUP_PARENT = "All Item Groups"

ITEMS = [
	"Subcontract Progress Billing",
	"Manpower Supply - Recharge",
	"Vehicle & Driver Rental",
]

# Bare account name (company abbreviation is appended per company at run time).
ITEM_INCOME_ACCOUNT = {
	"Subcontract Progress Billing": "Subcontract Income",
	"Manpower Supply - Recharge": "Manpower Supply Income",
	"Vehicle & Driver Rental": "Equipment Rental Income",
}

ACCOUNT_PARENT = {
	"Subcontract Income": "Direct Income",
	"Manpower Supply Income": "Direct Income",
	"Equipment Rental Income": "Direct Income",
}


def execute():
	create_item_group()
	create_items()

	for company in frappe.get_all("Company", fields=["name", "abbr"]):
		setup_company_accounts_and_defaults(company)


def create_item_group():
	if frappe.db.exists("Item Group", ITEM_GROUP):
		return

	frappe.get_doc(
		{
			"doctype": "Item Group",
			"item_group_name": ITEM_GROUP,
			"parent_item_group": ITEM_GROUP_PARENT,
			"is_group": 1,
		}
	).insert(ignore_permissions=True)


def create_items():
	for item_code in ITEMS:
		if frappe.db.exists("Item", item_code):
			continue

		frappe.get_doc(
			{
				"doctype": "Item",
				"item_code": item_code,
				"item_name": item_code,
				"item_group": ITEM_GROUP,
				"is_stock_item": 0,
				"stock_uom": "Nos",
			}
		).insert(ignore_permissions=True)


def setup_company_accounts_and_defaults(company):
	resolved_accounts = {}
	for account_name in set(ITEM_INCOME_ACCOUNT.values()):
		account = ensure_account(account_name, company)
		if account:
			resolved_accounts[account_name] = account

	for item_code, account_name in ITEM_INCOME_ACCOUNT.items():
		account = resolved_accounts.get(account_name)
		if account:
			set_item_default_income_account(item_code, company.name, account)


def ensure_account(account_name, company):
	full_name = f"{account_name} - {company.abbr}"
	if frappe.db.exists("Account", full_name):
		return full_name

	parent_name = f"{ACCOUNT_PARENT[account_name]} - {company.abbr}"
	if not frappe.db.exists("Account", parent_name):
		return None

	doc = frappe.get_doc(
		{
			"doctype": "Account",
			"account_name": account_name,
			"parent_account": parent_name,
			"company": company.name,
			"is_group": 0,
			"root_type": "Income",
			"report_type": "Profit and Loss",
			"account_type": "Income Account",
		}
	)
	doc.insert(ignore_permissions=True)
	return doc.name


def set_item_default_income_account(item_code, company_name, account):
	item = frappe.get_doc("Item", item_code)
	row = next((r for r in item.item_defaults if r.company == company_name), None)
	if not row:
		row = item.append("item_defaults", {"company": company_name})

	if row.income_account == account:
		return

	row.income_account = account
	item.save(ignore_permissions=True)