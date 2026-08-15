# Copyright (c) 2026, Hardik Gadesha and contributors
# For license information, please see license.txt

import re

import frappe
from frappe import _
from frappe.utils.pdf import get_file_data_from_writer
from frappe.www.printview import validate_print_permission
from pypdf import PdfWriter

QUOTATION_PDF_PRINT_FORMATS = [
	"Quotation Header",
	"Quotation BOQ Items",
	"Quotation Files",
	"Quotation Terms",
]

BOQ_PROJECT_PLAN_PRINT_FORMAT = "BOQ Project Plan"


@frappe.whitelist()
def get_merged_quotation_pdf(name):
	doc = frappe.get_doc("Quotation", name)
	validate_print_permission(doc)

	writer = PdfWriter()
	for print_format in QUOTATION_PDF_PRINT_FORMATS:
		frappe.get_print(
			doctype="Quotation",
			name=name,
			print_format=print_format,
			doc=doc,
			as_pdf=True,
			output=writer,
		)

		if print_format == "Quotation BOQ Items" and doc.get("custom_bill_of_quantities"):
			boq_doc = frappe.get_doc("Bill of Quantities", doc.custom_bill_of_quantities)
			frappe.get_print(
				doctype="Bill of Quantities",
				name=boq_doc.name,
				print_format=BOQ_PROJECT_PLAN_PRINT_FORMAT,
				doc=boq_doc,
				as_pdf=True,
				output=writer,
			)

	frappe.local.response.filename = "{0}.pdf".format(name.replace(" ", "-").replace("/", "-"))
	frappe.local.response.filecontent = get_file_data_from_writer(writer)
	frappe.local.response.type = "pdf"


@frappe.whitelist()
def create_new_quotation_version(source_name):
	source = frappe.get_doc("Quotation", source_name)
	if source.workflow_state != "Rejected":
		frappe.throw(_("Only a Rejected Quotation can be used to create a new version."))

	new_doc = frappe.copy_doc(source)
	new_doc.workflow_state = "Draft"
	new_doc.previous_version = source.name
	new_doc.insert()

	target_name = get_next_quotation_version_name(source.name)
	frappe.rename_doc("Quotation", new_doc.name, target_name, force=True)

	return target_name


def get_next_quotation_version_name(name):
	match = re.match(r"^(.*)-(\d+)$", name)
	base, version = (match.group(1), int(match.group(2))) if match else (name, 0)

	while True:
		version += 1
		candidate = f"{base}-{version}"
		if not frappe.db.exists("Quotation", candidate):
			return candidate