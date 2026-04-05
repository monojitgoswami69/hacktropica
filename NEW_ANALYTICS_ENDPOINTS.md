# New Analytics Endpoints

## 1. Individual Student Analytics

### Endpoint
```
GET /api/v1/analytics/student/{student_uid}/detail
```

### Description
Get detailed analytics for a specific student showing:
- Total queries
- Subjects they interact with most (with percentages)
- Top 10 modules they query (with percentages)
- Daily query activity for last 7 days

### Authorization
- Faculty/HOD/Admin: Can view any student
- Students: Can only view their own data

### Response Example
```json
{
  "uid": "abc123",
  "name": "John Doe",
  "roll": "CSE2021001",
  "email": "john@example.com",
  "stream": "cse",
  "semester": "3",
  "total_queries": 45,
  "subjects": [
    {
      "subject": "Data Structures",
      "query_count": 18,
      "percentage": 40.0
    },
    {
      "subject": "Operating Systems",
      "query_count": 15,
      "percentage": 33.3
    },
    {
      "subject": "DBMS",
      "query_count": 12,
      "percentage": 26.7
    }
  ],
  "modules": [
    {
      "document_id": "doc_ds_001",
      "title": "Arrays and Linked Lists",
      "subject": "Data Structures",
      "query_count": 8,
      "percentage": 17.8
    },
    {
      "document_id": "doc_os_001",
      "title": "Process Management",
      "subject": "Operating Systems",
      "query_count": 7,
      "percentage": 15.6
    }
  ],
  "daily_queries": [
    {"date": "30/03", "queries": 5},
    {"date": "31/03", "queries": 8},
    {"date": "01/04", "queries": 6},
    {"date": "02/04", "queries": 7},
    {"date": "03/04", "queries": 9},
    {"date": "04/04", "queries": 5},
    {"date": "05/04", "queries": 5}
  ]
}
```

### Use Cases
- View individual student's learning patterns
- Identify which subjects/modules a student struggles with
- Track student engagement over time
- Compare student activity across different topics

---

## 2. Module-Specific Student List

### Endpoint
```
GET /api/v1/analytics/module/{document_id}/students?semester=3
```

### Description
Get list of all students who interacted with a specific module/document.
Perfect for when clicking on a heatmap item in subject analysis.

### Authorization
- Faculty/HOD/Admin only

### Query Parameters
- `semester` (optional): Filter by semester

### Response Example
```json
{
  "document_id": "doc_ds_001",
  "title": "Arrays and Linked Lists",
  "subject": "Data Structures",
  "stream": "cse",
  "semester": "3",
  "total_students": 25,
  "total_queries": 120,
  "students": [
    {
      "uid": "student1",
      "name": "John Doe",
      "roll": "CSE2021001",
      "query_count": 15,
      "percentage": 33.3
    },
    {
      "uid": "student2",
      "name": "Jane Smith",
      "roll": "CSE2021002",
      "query_count": 12,
      "percentage": 26.7
    },
    {
      "uid": "student3",
      "name": "Bob Johnson",
      "roll": "CSE2021003",
      "query_count": 10,
      "percentage": 22.2
    }
  ]
}
```

### Use Cases
- Click on a module in the heatmap to see which students are struggling
- Identify students who need help with specific topics
- See engagement distribution across a module
- Find students who haven't interacted with important content

---

## Integration Examples

### Frontend: View Student Detail
```javascript
// When clicking on a student in the students list
async function viewStudentDetail(studentUid) {
  const response = await fetch(
    `/api/v1/analytics/student/${studentUid}/detail`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  const data = await response.json();
  
  // Display student analytics dashboard
  displayStudentDashboard(data);
}
```

### Frontend: View Module Students
```javascript
// When clicking on a heatmap cell/module
async function viewModuleStudents(documentId, semester) {
  const url = semester 
    ? `/api/v1/analytics/module/${documentId}/students?semester=${semester}`
    : `/api/v1/analytics/module/${documentId}/students`;
    
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  
  // Show modal/panel with student list
  showModuleStudentsModal(data);
}
```

---

## Summary

### New Endpoints Added:
1. `GET /api/v1/analytics/student/{student_uid}/detail` - Individual student analytics
2. `GET /api/v1/analytics/module/{document_id}/students` - Students who interacted with a module

### Features:
- ✅ Individual student analytics with subject/module breakdown
- ✅ Daily query activity tracking (last 7 days)
- ✅ Percentage calculations for better insights
- ✅ Module-specific student lists for heatmap drill-down
- ✅ Proper authorization (faculty can view all, students only themselves)
- ✅ Semester filtering support
- ✅ Sorted by query count (most active first)

### Data Shown:
- **Student Detail**: Total queries, subjects (with %), top modules (with %), daily activity
- **Module Students**: All students who queried the module, their query counts, percentages

These endpoints enable:
- Deep-dive into individual student learning patterns
- Identify struggling students on specific topics
- Track engagement at granular level
- Better intervention strategies for faculty
