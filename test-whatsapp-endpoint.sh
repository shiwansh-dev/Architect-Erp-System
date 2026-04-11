#!/bin/bash
# Test script for the send-offtime-whatsapp endpoint

curl -X POST http://localhost:3000/api/factory-genie/send-offtime-whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "deviceNo": 543,
    "date": "25/12/10",
    "phone": "919876543210",
    "allChannels": true,
    "allShifts": true,
    "minDuration": 20,
    "caption": "Test Off-Time Report"
  }'


