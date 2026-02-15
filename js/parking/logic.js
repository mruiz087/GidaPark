/**
 * Parking Rotation Logic (Canonical)
 * 
 * Definitions:
 * N = Number of spots
 * U = Number of users
 * K = U - N (if U > N, else 0)
 * Pj = Spot j (1..N)
 * Rk = Reserve k (1..K)
 */

/**
 * Generates the crossed order of reserves: 1, K, 2, K-1, 3, K-2...
 * @param {number} K 
 * @returns {number[]} Array of reserve indices
 */
function rOrder(K) {
    if (K <= 0) return [];
    const result = [];
    let left = 1;
    let right = K;

    while (left <= right) {
        if (left === right) {
            result.push(left);
            break;
        }
        result.push(left);
        result.push(right);
        left++;
        right--;
    }
    return result;
}

/**
 * Constructs the mold of spots and reserves.
 * @param {number} N Number of spots
 * @param {number} U Number of users
 * @returns {string[]} Array of strings like "P1", "R1", "P2", etc.
 */
function buildMold(N, U) {
    // 1. If U <= N, no reserves, just P1..PU
    if (U <= N) {
        const mold = [];
        for (let i = 1; i <= U; i++) {
            mold.push(`P${i}`);
        }
        return mold;
    }

    // 2. If U > N, logic with reserves
    const K = U - N;
    const reserves = rOrder(K); // The sequence of reserve indices
    const mold = [];

    const q = Math.floor(K / N);
    const r = K % N;

    let reserveIdx = 0;

    for (let j = 1; j <= N; j++) {
        // Add Pj
        mold.push(`P${j}`);

        // Calculate how many reserves to insert after Pj
        // q base, plus 1 extra if j <= r
        let numReservesToShow = q + (j <= r ? 1 : 0);

        // Insert them
        for (let k = 0; k < numReservesToShow; k++) {
            if (reserveIdx < reserves.length) {
                mold.push(`R${reserves[reserveIdx]}`);
                reserveIdx++;
            }
        }
    }

    // "Si sobran posiciones hasta U, completa con P consecutivas"
    // In strict theory N + K = U, so we shouldn't really have "leftover" slots if N+K=U matches exactly.
    // But if for some reason logic creates fewer items, we fill. 
    // Actually, "P consecutivas" implies P(N+1)... ?? No, logic says P1..PN are the only fixed spots.
    // Let's assume the mold is complete at this point. 
    // Check length:
    while (mold.length < U) {
        // Fallback provided by user rules is tricky: "completa con P consecutivas".
        // If we exhausted P1..PN and R1..RK, we have N+K items.
        // If mold.length < U, it implies U > N+K? Definition says K = U - N. So U = N + K.
        // Thus, mold.length SHOULD be exactly U.
        // We'll trust the math.
        break;
    }

    return mold.slice(0, U); // Ensure strict length U
}


/**
 * Rotates users array to the left by offset.
 * @param {any[]} users 
 * @param {number} offset 
 * @returns {any[]} New rotated array
 */
function rotateUsers(users, offset = 1) {
    if (!users || users.length === 0) return [];
    const len = users.length;
    const effectiveOffset = offset % len;
    if (effectiveOffset === 0) return [...users];

    // Rotate left: [0, 1, 2] offset 1 -> [1, 2, 0]
    return [...users.slice(effectiveOffset), ...users.slice(0, effectiveOffset)];
}

/**
 * Assigns users to the mold slots based on their interests.
 * @param {any[]} users Rotated members (priority order)
 * @param {string[]} mold Available slots (P1, R1, P2...)
 * @param {string[]} interests Array of user_ids that are attending on this date
 * @returns {object[]} Array of { slot: string, user: any, status: string }
 */
function assign(users, mold, interests = []) {
    const result = [];
    const interestedUsers = interests.length > 0
        ? users.filter(u => interests.includes(u.user_id))
        : users; // If interests empty, assume everyone (legacy/all-in)

    let moldIdx = 0;

    // First assign slots to those interested in priority order
    users.forEach(u => {
        const isInterested = interests.includes(u.user_id);

        if (isInterested && moldIdx < mold.length) {
            result.push({
                slot: mold[moldIdx],
                user: u,
                status: mold[moldIdx].startsWith('P') ? 'assigned' : 'reserve'
            });
            moldIdx++;
        } else if (!isInterested) {
            result.push({
                slot: 'none',
                user: u,
                status: 'not_attending'
            });
        } else {
            // Interested but no spots (even reserves) left in mold? 
            // In theory mold.length == users.length initially, 
            // but if someone is not attending, we skip their mold slot usage?
            // Actually users.length and mold.length are always equal (U).
            // So if someone is not interested, a spot/reserve becomes "free" at the end of the mold.
            result.push({
                slot: 'none',
                user: u,
                status: 'overflow'
            });
        }
    });

    return result;
}

// Export for Node vs Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { rOrder, buildMold, rotateUsers, assign };
} else {
    Object.assign(window, { rOrder, buildMold, rotateUsers, assign });
}
