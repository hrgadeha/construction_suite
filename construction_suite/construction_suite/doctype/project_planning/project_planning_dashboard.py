# Copyright (c) 2026, Hardik Gadesha and contributors
# For license information, please see license.txt

from frappe import _


def get_data():
	return {
		"fieldname": "project_planning",
		"transactions": [
			{"label": _("Bill of Quantities"), "items": ["Bill of Quantities"]},
		],
	}
