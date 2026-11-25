const { rOrder, buildMold, rotateUsers, assign } = require('./logic');

function verify(desc, actual, expected) {
    const actStr = JSON.stringify(actual);
    const expStr = JSON.stringify(expected);
    if (actStr === expStr) {
        console.log(`[PASS] ${desc}`);
    } else {
        console.error(`[FAIL] ${desc}`);
        console.error(`  Expected: ${expStr}`);
        console.error(`  Actual:   ${actStr}`);
    }
}

console.log('--- Verifying Parking Logic ---\n');

// Case 1: 5P, 5U -> Molde = P1..P5
const m1 = buildMold(5, 5);
verify('5P, 5U', m1, ["P1", "P2", "P3", "P4", "P5"]);

// Case 2: 4P, 5U -> K=1 -> Molde(5) = P1, R1, P2, P3, P4
// q=0, r=1. P1 gets R1. Others get 0.
const m2 = buildMold(4, 5);
verify('4P, 5U', m2, ["P1", "R1", "P2", "P3", "P4"]);

// Case 3: 5P, 10U -> K=5 -> Molde(10) = P1, R1, P2, R5, P3, R3, P4, R2, P5, R4
// R_order(5) = 1, 5, 2, 4, 3
// q=1, r=0. Every P gets 1 R.
const m3 = buildMold(5, 10);
verify('5P, 10U', m3, ["P1", "R1", "P2", "R5", "P3", "R2", "P4", "R4", "P5", "R3"]);
// WAIT: The user example says: P1, R1, P2, R5, P3, R3, P4, R2, P5, R4 ??
// My rOrder(5) -> 1, 5, 2, 4, 3
// Logic:
// P1 + R(1)
// P2 + R(5)
// P3 + R(2)
// P4 + R(4)
// P5 + R(3)
// User expectation: P3 -> R3? P4 -> R2? P5 -> R4?
// User said: "R_order(K) = 1, K, 2, K−1, 3, K−2..."
// For K=5: 1, 5, 2, 4, 3.
// User Expected Molde(10): P1, R1, P2, R5, P3, R3, P4, R2, P5, R4.
// My logic output would be: P1, R1, P2, R5, P3, R2, P4, R4, P5, R3
// Difference is indices 5,7,9 (0-based) i.e. the R's.
// My R's: 1, 5, 2, 4, 3.
// User R's in order of appearance: 1, 5, 3, 2, 4. 
// Wait, why 3, 2, 4? 
// User Example text: "P3, R3... P4, R2... P5, R4"
// That implies R sequence used: 1, 5, 3, 2, 4.
// User definition of rOrder: "1, K, 2, K−1, 3, K−2..."
// Let's trace user manual trace vs rOrder definition.
// Maybe user made a typo in the EXPECTED string or I misunderstood rOrder logic?
// "1, K, 2, K-1, 3, K-2..."
// K=5:
// 1
// 5
// 2
// 4
// 3 (middle)
// So 1, 5, 2, 4, 3 is correct per definition.
// User's Verification Case: "P1, R1, P2, R5, P3, R3, P4, R2, P5, R4"
// R values: 1, 5, 3, 2, 4.
// 1, 5, 3 is NOT "1, K, 2". It skips 2?
// Ah wait, maybe 3 is the middle?
// 1...5...
// 2...4...
// 3
// If we read pairs? (1,5), (2,4), (3).
// User has (1,5), (3??), (2,4??). 
// NO, look at P3, R3. R3 is the middle element.
// In user example: 1, 5, 3, 2, 4.
// In standard cross order: 1, 5, 2, 4, 3.
// Is it possible the user made a typo in the literal text of the verification case?
// "P1, R1, P2, R5, P3, R3, P4, R2, P5, R4"
// VS
// "P1, R1, P2, R5, P3, R2, P4, R4, P5, R3"
// I will implement strictly "1, K, 2, K-1..." as requested in rule 2.1.
// If the test FAILS against the literal string, I will log it but trust the ALGORITHM rule over the manual example if they conflict, OR I will adjust if I see a pattern.
// Let's look at another case.
// Case 4: 8P, 15U -> K=7.
// rOrder(7) -> 1, 7, 2, 6, 3, 5, 4.
// User Example: "... P3, R2, P4, R6, P5, R3, P6, R5, P7, R4..."
// R's used: 1, 7, 2, 6, 3, 5, 4.
// My sequence: 1, 7, 2, 6, 3, 5, 4.
// User mapping:
// P1->R1
// P2->R7
// P3->R2
// P4->R6
// P5->R3
// P6->R5
// P7->R4 (Wait, 4 should be last? 4 is middle of 1..7)
// P8-> ?? (K=7, N=8. We have 7 reserves. q=0, r=7. P1..P7 get 1. P8 gets 0.)
// User exp: P1,R1... P7,R4, P8.
// My R sequence: 1, 7, 2, 6, 3, 5, 4.
// User exp R sequence: 1, 7, 2, 6, 3, 5, 4. 
// MATCHES!
// So Case 4 matches my logic.
// Case 3 (5P, 10U, K=5) User sequence: 1, 5, 3, 2, 4.
// My logic: 1, 5, 2, 4, 3.
// Why did user expect 3 in 3rd spot?
// Maybe user manually messed up Case 3 text? 
// "P1, R1, P2, R5, P3, R3..." -> R3 is middle. User put it early?
// "P4, R2, P5, R4" -> 2 and 4 at end?
// I will stick to the Algorithmic definition (1, K, 2, K-1...) because Case 4 confirms it works for K=7. Case 3 seems to have a typo in the prompt's example.
// I will verify against the computed expectation of the algorithm.

const m4 = buildMold(8, 15);
// K=7. R=1,7,2,6,3,5,4. q=0, r=7.
// P1..P7 get 1 R. P8 gets 0.
// Exp: P1,R1, P2,R7, P3,R2, P4,R6, P5,R3, P6,R5, P7,R4, P8
verify('8P, 15U (K=7)', m4, [
    "P1", "R1", "P2", "R7", "P3", "R2", "P4", "R6", "P5", "R3", "P6", "R5", "P7", "R4", "P8"
]);

// Case 5: 8P, 17U -> K=9.
// R_order(9) = 1,9,2,8,3,7,4,6,5
// q=1, r=1.
// J=1 (P1): q+1 = 2 reserves. (R1, R9)
// J=2..8: q = 1 reserve.
// Sequence:
// P1, R1, R9
// P2, R2
// P3, R8
// P4, R3
// P5, R7
// P6, R4
// P7, R6
// P8, R5
const m5 = buildMold(8, 17);
verify('8P, 17U (K=9)', m5, [
    "P1", "R1", "R9", "P2", "R2", "P3", "R8", "P4", "R3", "P5", "R7", "P6", "R4", "P7", "R6", "P8", "R5"
]);

// Re-check Case 3 with my logic:
// K=5 -> 1, 5, 2, 4, 3.
verify('5P, 10U (My Logic)', m3, ["P1", "R1", "P2", "R5", "P3", "R2", "P4", "R4", "P5", "R3"]);

// Check rotation
const users = [
    { user_id: '1', display_name: 'A' },
    { user_id: '2', display_name: 'B' },
    { user_id: '3', display_name: 'C' },
    { user_id: '4', display_name: 'D' },
    { user_id: '5', display_name: 'E' }
];
const rot = rotateUsers(users, 1);
verify('Rotate Users offset 1', rot[0].user_id, '2');

// Case 1: 5P, 5U, no interests provided (should be NONE now)
const m1Interest = buildMold(5, 5);
const assignedEmpty = assign(users, m1Interest);
verify('Assign 5P, 5U (None)', assignedEmpty.filter(a => a.status === 'assigned').length, 0);

// Case 1b: 5P, 5U, all interests provided
const allIds = users.map(u => u.user_id);
const assignedAll = assign(users, m1Interest, allIds);
verify('Assign 5P, 5U (All)', assignedAll.filter(a => a.status === 'assigned').length, 5);

// Case 2: 5P, 5U, only users 1 and 3 interested
const interests13 = ['1', '3'];
const assigned13 = assign(users, m1, interests13);
verify('Assign 5P, 5U (1,3) user1', assigned13.find(a => a.user.user_id === '1').status, 'assigned');
verify('Assign 5P, 5U (1,3) user2', assigned13.find(a => a.user.user_id === '2').status, 'not_attending');
verify('Assign 5P, 5U (1,3) count', assigned13.filter(a => a.status === 'assigned').length, 2);

// Case 3: 2P, 5U, only users 1, 2, 3 interested
// Priority (rotated offset 0): 1, 2, 3, 4, 5
// Spots: P1 (user 1), P2 (user 2)
// Reserve: R1 (user 3)
// Not attending: 4, 5 (not in interests)
const m3_2p = buildMold(2, 5); // ["P1", "R1", "P2", "R2", "R3"] wait...
// mold for 2P, 5U (K=3) -> rOrder(3) = 1, 3, 2. 
// q=1, r=1.
// J=1 (P1): 1+1=2 R's -> P1, R1, R3
// J=2 (P2): 1 R -> P2, R2
// Mold: P1, R1, R3, P2, R2
const assigned2p = assign(users, m3_2p, ['1', '2', '3']);
verify('Assign 2P, 5U (1,2,3) P1', assigned2p.find(a => a.user.user_id === '1').status, 'assigned');
verify('Assign 2P, 5U (1,2,3) P2', assigned2p.find(a => a.user.user_id === '2').status, 'assigned');
verify('Assign 2P, 5U (1,2,3) R1', assigned2p.find(a => a.user.user_id === '3').status, 'reserve');
verify('Assign 2P, 5U (1,2,3) none', assigned2p.find(a => a.user.user_id === '4').status, 'not_attending');

