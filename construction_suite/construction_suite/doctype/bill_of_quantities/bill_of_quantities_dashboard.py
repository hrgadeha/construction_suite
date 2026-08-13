# Copyright (c) 2026, Hardik Gadesha and contributors
# For license information, please see license.txt

from frappe import _


def get_data():
	return {
		"fieldname": "custom_bill_of_quantities",
		"transactions": [
			{"label": _("Quotation"), "items": ["Quotation"]},
			{"label": _("Sales Order"), "items": ["Sales Order"]},
		],
	}
