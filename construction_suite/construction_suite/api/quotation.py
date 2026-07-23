# Copyright (c) 2026, Hardik Gadesha and contributors
# For license information, please see license.txt

import frappe
from frappe.utils.pdf import get_file_data_from_writer
from frappe.www.printview import validate_print_permission
from pypdf import PdfWriter

QUOTATION_PDF_PRINT_FORMATS = [
	"Quotation Header",
	"Quotation Files",
	"Quotation Terms",
]


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

	frappe.local.response.filename = "{0}.pdf".format(name.replace(" ", "-").replace("/", "-"))
	frappe.local.response.filecontent = get_file_data_from_writer(writer)
	frappe.local.response.type = "pdf"