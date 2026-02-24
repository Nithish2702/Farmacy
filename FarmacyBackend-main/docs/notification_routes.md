# Notification Routes Documentation

This document describes the available notification-related API endpoints in the Farmacy backend.

## Base URL

All notification routes are prefixed with `/notifications`

## Authentication

All routes require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### Create Notification
- **POST** `/notifications/`
- Creates a new notification for the authenticated user
- Request body:
  ```json
  {
    "type": "DAILY_UPDATE",
    "title": "Daily Update",
    "message": "Your daily farming tasks",
    "priority": "MEDIUM",
    "data": {
      "crop_id": 1,
      "week_number": 2
    },
    "scheduled_for": "2024-03-20T08:00:00Z",
    "language": "en"
  }
  ```

### Get Notifications
- **GET** `/notifications/`
- Retrieves notifications for the authenticated user
- Query parameters:
  - `skip`: Number of records to skip (default: 0)
  - `limit`: Maximum number of records to return (default: 100)
  - `type`: Filter by notification type (optional)

### Create Topic
- **POST** `/notifications/topics`
- Creates a new notification topic (admin only)
- Request body:
  ```json
  {
    "name": "weather_alerts",
    "description": "Weather-related notifications",
    "type": "weather"
  }
  ```

### Subscribe to Topic
- **POST** `/notifications/topics/{topic_name}/subscribe`
- Subscribes the authenticated user to a notification topic
- Path parameters:
  - `topic_name`: Name of the topic to subscribe to

### Unsubscribe from Topic
- **POST** `/notifications/topics/{topic_name}/unsubscribe`
- Unsubscribes the authenticated user from a notification topic
- Path parameters:
  - `topic_name`: Name of the topic to unsubscribe from

### Get Topics
- **GET** `/notifications/topics`
- Retrieves all available notification topics

### Update Notification Settings
- **PUT** `/notifications/settings`
- Updates the authenticated user's notification settings
- Request body:
  ```json
  {
    "email_notifications": true,
    "sms_notifications": false,
    "push_notifications": true,
    "notification_types": {
      "daily_updates": true,
      "disease_alerts": true,
      "weather_alerts": true,
      "market_updates": false,
      "news_alerts": true
    },
    "notification_frequency": "daily",
    "quiet_hours_start": "22:00",
    "quiet_hours_end": "07:00"
  }
  ```

### Register FCM Token
- **POST** `/notifications/fcm/register`
- Registers a new FCM token for push notifications
- Request body:
  ```json
  {
    "token": "fcm_token_string",
    "device_type": "android"
  }
  ```

### Unregister FCM Token
- **POST** `/notifications/fcm/unregister`
- Unregisters an FCM token
- Request body:
  ```json
  {
    "token": "fcm_token_string"
  }
  ```

## Notification Types

- `DAILY_UPDATE`: Daily farming tasks and updates
- `DISEASE_ALERT`: Disease outbreak alerts
- `WEATHER_ALERT`: Weather-related notifications
- `MARKET_UPDATE`: Market price updates
- `NEWS_ALERT`: Agricultural news alerts

## Notification Priority

- `LOW`: Non-urgent notifications
- `MEDIUM`: Standard priority notifications
- `HIGH`: Urgent notifications

## Scheduled Tasks

The system includes several scheduled tasks for notifications:

1. Daily Updates: Runs at 8 AM daily
2. Disease Alerts: Runs every 6 hours
3. Weather Alerts: Runs every 3 hours
4. Market Updates: Runs at 9 AM and 5 PM
5. News Alerts: Runs at 10 AM and 4 PM
6. Demo Notification: Runs every 30 seconds (for testing purposes)

## Error Responses

All endpoints may return the following error responses:

- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `400 Bad Request`: Invalid request parameters
- `500 Internal Server Error`: Server-side error

## Example Usage

### Creating a Notification
```bash
curl -X POST http://localhost:8000/notifications/ \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "DAILY_UPDATE",
    "title": "Daily Tasks",
    "message": "Time to water your crops",
    "priority": "MEDIUM"
  }'
```

### Subscribing to a Topic
```bash
curl -X POST http://localhost:8000/notifications/topics/weather_alerts/subscribe \
  -H "Authorization: Bearer <your_token>"
```

### Updating Notification Settings
```bash
curl -X PUT http://localhost:8000/notifications/settings \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email_notifications": true,
    "push_notifications": true,
    "notification_types": {
      "weather_alerts": true
    }
  }'
``` 