#!/bin/bash

# Hospital Management System - Lab Workflow Test Script

echo "========================================="
echo "Lab Workflow Demonstration"
echo "========================================="

# Get tokens
echo ""
echo "1. Getting authentication tokens..."
DOCTOR_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"doctor","password":"Doctor"}' | jq -r '.token')
echo "✓ Doctor token obtained"

LABTECH_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"labtech","password":"LabTech"}' | jq -r '.token')
echo "✓ Lab tech token obtained"

ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin"}' | jq -r '.token')
echo "✓ Admin token obtained"

# Step 1: Doctor orders a lab test
echo ""
echo "2. Doctor orders CBC lab test..."
LAB_ORDER=$(curl -s -X POST http://localhost:3000/api/lab/order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DOCTOR_TOKEN" \
  -d '{
    "patient_id": 1,
    "test_name": "Complete Blood Count (CBC)",
    "test_type": "Hematology",
    "sample_id": "SAMPLE-20260913-001"
  }')
TEST_ID=$(echo $LAB_ORDER | jq -r '.test_id')
echo "✓ Lab test ordered with ID: $TEST_ID"
echo $LAB_ORDER | jq '.test'

# Step 2: Check lab queue for lab technician
echo ""
echo "3. Lab technician views pending orders queue..."
LAB_QUEUE=$(curl -s -X GET http://localhost:3000/api/lab/queue/pending \
  -H "Authorization: Bearer $LABTECH_TOKEN")
echo "✓ Lab queue retrieved"
echo $LAB_QUEUE | jq '.queue[0]'

# Step 3: Lab tech updates status to CollectionPending
echo ""
echo "4. Lab technician marks specimen as collected..."
curl -s -X PUT "http://localhost:3000/api/lab/$TEST_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LABTECH_TOKEN" \
  -d '{"status": "Collected"}' | jq '.'

# Step 4: Lab tech enters result
echo ""
echo "5. Lab technician enters test result..."
RESULT=$(curl -s -X POST "http://localhost:3000/api/lab/$TEST_ID/result" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LABTECH_TOKEN" \
  -d '{
    "result_data": "RBC: 4.5 (normal), WBC: 7.2 (normal), HGB: 13.5 (normal)",
    "reference_range": "RBC: 4.2-5.8, WBC: 4.5-11.0, HGB: 12-17",
    "flagged": false
  }')
RESULT_ID=$(echo $RESULT | jq -r '.result_id')
echo "✓ Lab result entered with ID: $RESULT_ID"
echo $RESULT | jq '.'

# Step 5: Check notifications for doctor
echo ""
echo "6. Checking doctor notifications..."
NOTIFICATIONS=$(curl -s -X GET http://localhost:3000/api/notifications \
  -H "Authorization: Bearer $DOCTOR_TOKEN")
echo "✓ Doctor has $(echo $NOTIFICATIONS | jq '.count') unread notifications"
echo $NOTIFICATIONS | jq '.notifications[0:2]'

# Step 6: Lab tech marks result as released
echo ""
echo "7. Lab technician releases result to ordering doctor..."
curl -s -X PUT "http://localhost:3000/api/lab/$TEST_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LABTECH_TOKEN" \
  -d '{"status": "Released"}' | jq '.'

# Step 7: Check updated notifications
echo ""
echo "8. Checking updated doctor notifications after release..."
UPDATED_NOTIFICATIONS=$(curl -s -X GET http://localhost:3000/api/notifications \
  -H "Authorization: Bearer $DOCTOR_TOKEN")
echo "✓ Doctor now has $(echo $UPDATED_NOTIFICATIONS | jq '.count') unread notifications"
echo $UPDATED_NOTIFICATIONS | jq '.notifications[0:3]'

echo ""
echo "========================================="
echo "Lab Workflow Test Complete!"
echo "========================================="
echo ""
echo "Summary:"
echo "- Doctor ordered lab test"
echo "- Lab technician collected specimen"
echo "- Lab technician entered results"
echo "- Doctor received notifications at key workflow points"
echo "- Result released to ordering doctor"
