# WAHA WhatsApp Integration Setup

This document describes how to set up and use the WhatsApp integration endpoint for sending off-time analysis images.

## Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# WAHA API Configuration
WAHA_API_URL=https://wapi.tranceedtechnology.com
WAHA_API_KEY=74711624874636775040840769354246

# Application URL (for internal API calls)
NEXT_PUBLIC_APP_URL=https://app.tranceedtechnology.com
```

## API Endpoint

### POST `/api/factory-genie/send-offtime-whatsapp`

Sends an off-time analysis image to WhatsApp using the WAHA API.

#### Request Body

```json
{
  "deviceNo": 543,
  "date": "25/12/10",
  "phone": "919876543210",
  "allChannels": true,
  "allShifts": true,
  "minDuration": 20,
  "statusFilters": "OFF,LOW,OUT",
  "caption": "Optional caption for the image"
}
```

#### Parameters

- **deviceNo** (required): Device number
- **date** (required): Date in YY/MM/DD format (e.g., "25/12/10")
- **phone** (required): WhatsApp phone number with country code (digits only, e.g., "919876543210")
- **channel** (optional): Channel key (ch1-ch8). If not provided, `allChannels` defaults to `true`
- **allChannels** (optional, default: `true`): Set to `true` to include all channels
- **shift** (optional): Shift name (morning/evening/night). If not provided, `allShifts` defaults to `true`
- **allShifts** (optional, default: `true`): Set to `true` to include all shifts
- **minDuration** (optional, default: `20`): Minimum duration in minutes
- **statusFilters** (optional, default: `"OFF,LOW,OUT"`): Comma-separated statuses to include
- **caption** (optional): Caption text for the WhatsApp message

#### Response

**Success (200):**
```json
{
  "success": true,
  "message": "Image sent successfully to WhatsApp",
  "wahaResponse": { ... },
  "imageSize": 123456,
  "phone": "919876543210"
}
```

**Error (400/500):**
```json
{
  "error": "Error message",
  "details": "..."
}
```

## Example Usage

### Using cURL

```bash
curl -X POST https://app.tranceedtechnology.com/api/factory-genie/send-offtime-whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "deviceNo": 543,
    "date": "25/12/10",
    "phone": "919876543210",
    "allChannels": true,
    "allShifts": true,
    "minDuration": 20,
    "caption": "Daily Off-Time Report"
  }'
```

### Using JavaScript/TypeScript

```javascript
const response = await fetch('/api/factory-genie/send-offtime-whatsapp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    deviceNo: 543,
    date: '25/12/10',
    phone: '919876543210',
    allChannels: true,
    allShifts: true,
    minDuration: 20,
    caption: 'Daily Off-Time Report'
  })
});

const data = await response.json();
if (data.success) {
  console.log('Image sent successfully!');
} else {
  console.error('Error:', data.error);
}
```

## How It Works

1. The endpoint receives the request with device number, date, phone number, and other parameters
2. It calls the internal `/api/factory-genie/analyze-offtime` endpoint to generate the image
3. The generated PNG image is converted to base64 format
4. The image is sent to the WAHA API with the recipient's phone number
5. WAHA API delivers the image to WhatsApp

## Phone Number Format

- Include country code (e.g., `91` for India)
- No `+` sign or spaces
- Example: `919876543210` (India: +91 98765 43210)

## Troubleshooting

### Image Generation Fails

- Check that the `deviceNo` and `date` are valid
- Verify that data exists for the specified device and date
- Check server logs for Puppeteer errors

### WAHA API Fails

- Verify `WAHA_API_URL` and `WAHA_API_KEY` are correct
- Check that the phone number format is correct (digits only with country code)
- Ensure the WAHA API server is accessible
- Check WAHA API documentation for endpoint changes

### Internal API Call Fails

- Verify `NEXT_PUBLIC_APP_URL` is set correctly
- For local development, it should be `http://localhost:3000`
- For production, it should be your production URL


