.PHONY: setup pipeline dashboard

PYTHON ?= python3

setup:
	$(PYTHON) -m pip install -r requirements.txt
	npm --prefix dashboard ci

pipeline:
	$(PYTHON) load_data.py
	$(PYTHON) analysis.py

dashboard:
	npm --prefix dashboard run build
	$(PYTHON) dashboard_api.py
