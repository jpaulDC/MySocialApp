using Microsoft.EntityFrameworkCore;
using SocialAppAPI.Data;
using SocialAppAPI.DTOs;
using SocialAppAPI.Models;

namespace SocialAppAPI.Services
{
    public class FriendService
    {
        private readonly AppDbContext _context;

        public FriendService(AppDbContext context)
        {
            _context = context;
        }

        // ── SEND FRIEND REQUEST ────────────────────────────────────────
        public async Task<(bool Success, string Message)> SendRequestAsync(
            int requesterId, int addresseeId)
        {
            // Cannot send request to yourself
            if (requesterId == addresseeId)
                return (false, "You cannot send a friend request to yourself.");

            // Check if the target user exists
            var addressee = await _context.Users.FindAsync(addresseeId);
            if (addressee == null)
                return (false, "User not found.");

            // Check if a friendship record already exists (either direction)
            var existing = await _context.Friendships.FirstOrDefaultAsync(f =>
                (f.RequesterId == requesterId && f.AddresseeId == addresseeId) ||
                (f.RequesterId == addresseeId && f.AddresseeId == requesterId));

            if (existing != null)
            {
                if (existing.Status == FriendshipStatus.Accepted)
                    return (false, "You are already friends.");
                if (existing.Status == FriendshipStatus.Pending)
                    return (false, "Friend request already sent.");
                if (existing.Status == FriendshipStatus.Rejected)
                {
                    // Allow re-sending if previously rejected
                    existing.Status = FriendshipStatus.Pending;
                    existing.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    return (true, "Friend request re-sent!");
                }
            }

            // Create new friendship record
            var friendship = new Friendship
            {
                RequesterId = requesterId,
                AddresseeId = addresseeId,
                Status = FriendshipStatus.Pending
            };

            _context.Friendships.Add(friendship);
            await _context.SaveChangesAsync();

            return (true, "Friend request sent!");
        }

        // ── ACCEPT FRIEND REQUEST ──────────────────────────────────────
        public async Task<(bool Success, string Message)> AcceptRequestAsync(
            int currentUserId, int friendshipId)
        {
            var friendship = await _context.Friendships.FindAsync(friendshipId);

            if (friendship == null)
                return (false, "Friend request not found.");

            // Only the ADDRESSEE (receiver) can accept the request
            if (friendship.AddresseeId != currentUserId)
                return (false, "You are not authorized to accept this request.");

            if (friendship.Status != FriendshipStatus.Pending)
                return (false, "This request is no longer pending.");

            // Update status to Accepted
            friendship.Status = FriendshipStatus.Accepted;
            friendship.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return (true, "Friend request accepted!");
        }

        // ── REJECT FRIEND REQUEST ──────────────────────────────────────
        public async Task<(bool Success, string Message)> RejectRequestAsync(
            int currentUserId, int friendshipId)
        {
            var friendship = await _context.Friendships.FindAsync(friendshipId);

            if (friendship == null)
                return (false, "Friend request not found.");

            // Only the ADDRESSEE can reject
            if (friendship.AddresseeId != currentUserId)
                return (false, "You are not authorized to reject this request.");

            if (friendship.Status != FriendshipStatus.Pending)
                return (false, "This request is no longer pending.");

            friendship.Status = FriendshipStatus.Rejected;
            friendship.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return (true, "Friend request rejected.");
        }

        // ── UNFRIEND ───────────────────────────────────────────────────
        public async Task<(bool Success, string Message)> UnfriendAsync(
            int currentUserId, int friendshipId)
        {
            var friendship = await _context.Friendships.FindAsync(friendshipId);

            if (friendship == null)
                return (false, "Friendship not found.");

            // Either user can unfriend
            if (friendship.RequesterId != currentUserId &&
                friendship.AddresseeId != currentUserId)
                return (false, "You are not part of this friendship.");

            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync();

            return (true, "Unfriended successfully.");
        }

        // ── GET MY FRIENDS LIST ────────────────────────────────────────
        public async Task<List<FriendDto>> GetFriendsAsync(int userId)
        {
            // Get all ACCEPTED friendships where user is involved
            var friendships = await _context.Friendships
                .Include(f => f.Requester)
                .Include(f => f.Addressee)
                .Where(f =>
                    (f.RequesterId == userId || f.AddresseeId == userId) &&
                    f.Status == FriendshipStatus.Accepted)
                .ToListAsync();

            // Map to FriendDto – show the OTHER person's info
            return friendships.Select(f =>
            {
                // Determine which user is the "friend" (not the current user)
                var isRequester = f.RequesterId == userId;
                var friend = isRequester ? f.Addressee : f.Requester;

                return new FriendDto
                {
                    FriendshipId = f.Id,
                    UserId = friend.Id,
                    Username = friend.Username,
                    FullName = friend.FullName,
                    ProfilePictureUrl = friend.ProfilePictureUrl,
                    Status = "Accepted",
                    IsRequester = isRequester,
                    CreatedAt = f.CreatedAt
                };
            }).ToList();
        }

        // ── GET PENDING REQUESTS (received) ───────────────────────────
        public async Task<List<FriendDto>> GetPendingRequestsAsync(int userId)
        {
            // Requests where current user is the ADDRESSEE and status is Pending
            var requests = await _context.Friendships
                .Include(f => f.Requester)
                .Where(f =>
                    f.AddresseeId == userId &&
                    f.Status == FriendshipStatus.Pending)
                .ToListAsync();

            return requests.Select(f => new FriendDto
            {
                FriendshipId = f.Id,
                UserId = f.Requester.Id,
                Username = f.Requester.Username,
                FullName = f.Requester.FullName,
                ProfilePictureUrl = f.Requester.ProfilePictureUrl,
                Status = "Pending",
                IsRequester = false, // Current user is the receiver
                CreatedAt = f.CreatedAt
            }).ToList();
        }

        // ── GET FRIENDSHIP STATUS ──────────────────────────────────────
        // Useful to show the correct button on someone's profile
        public async Task<(string Status, int? FriendshipId)> GetStatusAsync(
            int currentUserId, int otherUserId)
        {
            var friendship = await _context.Friendships.FirstOrDefaultAsync(f =>
                (f.RequesterId == currentUserId && f.AddresseeId == otherUserId) ||
                (f.RequesterId == otherUserId && f.AddresseeId == currentUserId));

            if (friendship == null)
                return ("None", null);

            return (friendship.Status.ToString(), friendship.Id);
        }

        // ── SEARCH USERS ───────────────────────────────────────────────
        public async Task<List<UserProfileDto>> SearchUsersAsync(
            int currentUserId, string query)
        {
            if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
                return new List<UserProfileDto>();

            // Search by username or full name (case-insensitive)
            var users = await _context.Users
                .Where(u =>
                    u.Id != currentUserId && // Exclude self
                    (u.Username.ToLower().Contains(query.ToLower()) ||
                     (u.FullName != null &&
                      u.FullName.ToLower().Contains(query.ToLower()))))
                .Take(20) // Max 20 results
                .ToListAsync();

            return users.Select(u => new UserProfileDto
            {
                Id = u.Id,
                Username = u.Username,
                FullName = u.FullName,
                ProfilePictureUrl = u.ProfilePictureUrl,
                Bio = u.Bio,
                CreatedAt = u.CreatedAt
            }).ToList();
        }
    }
}