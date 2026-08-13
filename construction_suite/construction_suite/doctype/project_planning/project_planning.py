# Copyright (c) 2026, Hardik Gadesha and contributors
# For license information, please see license.txt

from frappe.model.document import Document
from frappe.utils import date_diff, getdate


class ProjectPlanning(Document):
	def validate(self):
		self.calculate_milestone_days()
		self.calculate_planned_total_days()

	def calculate_milestone_days(self):
		for row in self.project_planning_milestones:
			if row.start_date and row.end_date:
				row.total_days = date_diff(row.end_date, row.start_date) + 1
			else:
				row.total_days = 0

	def calculate_planned_total_days(self):
		start_dates = [getdate(row.start_date) for row in self.project_planning_milestones if row.start_date]
		end_dates = [getdate(row.end_date) for row in self.project_planning_milestones if row.end_date]

		if not start_dates or not end_dates:
			self.planned_total_days = 0
			return

		total_days = date_diff(max(end_dates), min(start_dates)) + 1
		self.planned_total_days = total_days if total_days > 0 else 0
