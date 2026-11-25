const SUPABASE_URL = 'https://bfvdolcbtncxnspxgfcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdmRvbGNidG5jeG5zcHhnZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzY3NTEsImV4cCI6MjA4MzU1Mjc1MX0.dB8GBmomyk5s19CBXfB2TKjt3tKokAZ6HcqV8l29lQQ';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Group types
const GROUP_TYPES = {
    FLEXIBLE: 'flexible',
    FIXED: 'fixed',
    PARKING: 'parking'
};

// Global State
var user = null;
var currentUser = null; // Alias for fixed modules
var currentGroupId = null;
var currentGroupType = null;
var currentGroup = null;
var groupMembers = [];
var allTrips = [];
var selectedDate = null;
var viewDate = new Date();
viewDate.setDate(1);

// Flexible trip selection state
var selectedTripType = 'ida_vuelta';
var selectedTripRepeat = 0;
