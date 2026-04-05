# Frontend Analytics Integration Guide

## API Endpoints Added

I've added two new methods to `admin-frontend/src/services/api.js`:

### 1. Student Detail Analytics
```javascript
api.analytics.studentDetail(studentUid)
```

**Returns:**
```javascript
{
  uid: "abc123",
  name: "John Doe",
  roll: "CSE2021001",
  email: "john@example.com",
  stream: "cse",
  semester: "3",
  total_queries: 45,
  subjects: [
    { subject: "Data Structures", query_count: 18, percentage: 40.0 },
    { subject: "Operating Systems", query_count: 15, percentage: 33.3 }
  ],
  modules: [
    { 
      document_id: "doc_ds_001", 
      title: "Arrays and Linked Lists",
      subject: "Data Structures",
      query_count: 8,
      percentage: 17.8
    }
  ],
  daily_queries: [
    { date: "30/03", queries: 5 },
    { date: "31/03", queries: 8 }
  ]
}
```

### 2. Module Students List
```javascript
api.analytics.moduleStudents(documentId, semester)
```

**Returns:**
```javascript
{
  document_id: "doc_ds_001",
  title: "Arrays and Linked Lists",
  subject: "Data Structures",
  stream: "cse",
  semester: "3",
  total_students: 25,
  total_queries: 120,
  students: [
    {
      uid: "student1",
      name: "John Doe",
      roll: "CSE2021001",
      query_count: 15,
      percentage: 33.3
    }
  ]
}
```

## Frontend Changes Needed

### 1. Students Page (`admin-frontend/src/app/(dashboard)/students/page.jsx`)

Add "View Analytics" button to each student row:

```jsx
// In the table row, replace the MoreVertical button with:
<td className="px-6 py-4 text-right">
  <button 
    onClick={() => viewStudentAnalytics(student.uid)}
    className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
  >
    View Analytics
  </button>
</td>

// Add this function:
const viewStudentAnalytics = async (studentUid) => {
  try {
    const data = await api.analytics.studentDetail(studentUid);
    // Show modal or navigate to detail page
    setSelectedStudent(data);
    setShowAnalyticsModal(true);
  } catch (error) {
    console.error('Failed to load student analytics:', error);
  }
};
```

### 2. Student Analytics Modal Component

Create a new modal to display student analytics:

```jsx
{showAnalyticsModal && selectedStudent && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{selectedStudent.name}</h2>
            <p className="text-sm text-neutral-500">
              {selectedStudent.roll} • {selectedStudent.stream.toUpperCase()} • Sem {selectedStudent.semester}
            </p>
          </div>
          <button onClick={() => setShowAnalyticsModal(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Total Queries */}
        <div className="bg-indigo-50 p-4 rounded-lg">
          <p className="text-sm text-indigo-600 font-medium">Total Queries</p>
          <p className="text-3xl font-bold text-indigo-900">{selectedStudent.total_queries}</p>
        </div>

        {/* Subjects */}
        <div>
          <h3 className="font-semibold mb-3">Subject Breakdown</h3>
          <div className="space-y-2">
            {selectedStudent.subjects.map((subj, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <span className="font-medium">{subj.subject}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-neutral-500">{subj.query_count} queries</span>
                  <span className="text-sm font-bold text-indigo-600">{subj.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Modules */}
        <div>
          <h3 className="font-semibold mb-3">Top Modules</h3>
          <div className="space-y-2">
            {selectedStudent.modules.map((mod, i) => (
              <div key={i} className="p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{mod.title}</p>
                    <p className="text-xs text-neutral-500">{mod.subject}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-indigo-600">{mod.query_count} queries</p>
                    <p className="text-xs text-neutral-500">{mod.percentage}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Activity Chart */}
        <div>
          <h3 className="font-semibold mb-3">Last 7 Days Activity</h3>
          <div className="flex items-end justify-between gap-2 h-32">
            {selectedStudent.daily_queries.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div 
                  className="w-full bg-indigo-500 rounded-t"
                  style={{ height: `${(day.queries / Math.max(...selectedStudent.daily_queries.map(d => d.queries))) * 100}%` }}
                ></div>
                <span className="text-xs text-neutral-500">{day.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
)}
```

### 3. Subject Analysis Page (`admin-frontend/src/app/(dashboard)/subject-analysis/page.jsx`)

Make modules clickable to show students who interacted with them:

```jsx
// In the module heatmap/list, make each module clickable:
const handleModuleClick = async (documentId) => {
  try {
    const data = await api.analytics.moduleStudents(documentId, filterSemester);
    setSelectedModule(data);
    setShowModuleStudentsModal(true);
  } catch (error) {
    console.error('Failed to load module students:', error);
  }
};

// Add modal for module students:
{showModuleStudentsModal && selectedModule && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{selectedModule.title}</h2>
            <p className="text-sm text-neutral-500">
              {selectedModule.subject} • {selectedModule.total_students} students • {selectedModule.total_queries} queries
            </p>
          </div>
          <button onClick={() => setShowModuleStudentsModal(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Students List */}
      <div className="p-6">
        <div className="space-y-2">
          {selectedModule.students.map((student, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                  {student.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{student.name}</p>
                  <p className="text-xs text-neutral-500">{student.roll}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-indigo-600">{student.query_count} queries</p>
                <p className="text-xs text-neutral-500">{student.percentage}% of their total</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)}
```

## Implementation Steps

1. ✅ **Backend endpoints created** - Already done
2. ✅ **API service updated** - Already done
3. ⏳ **Update Students page** - Add "View Analytics" button and modal
4. ⏳ **Update Subject Analysis page** - Make modules clickable with student list modal
5. ⏳ **Test the flow** - Click through and verify data displays correctly

## Quick Integration Example

For a minimal integration, just add this to the students page:

```jsx
// Add state
const [selectedStudent, setSelectedStudent] = useState(null);
const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

// Replace MoreVertical button with:
<button 
  onClick={async () => {
    const data = await api.analytics.studentDetail(student.uid);
    setSelectedStudent(data);
    setShowAnalyticsModal(true);
  }}
  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
>
  Analytics
</button>
```

That's it! The backend is ready, API is connected, you just need to add the UI components.
