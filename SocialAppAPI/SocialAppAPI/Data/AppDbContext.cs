using Microsoft.EntityFrameworkCore;
using SocialAppAPI.Models;

namespace SocialAppAPI.Data
{
    // This class connects your app to the PostgreSQL database
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // Represents the tables in your database
        public DbSet<User> Users { get; set; } // Isa na lang ito dapat
        public DbSet<Friendship> Friendships { get; set; }
        public DbSet<Post> Posts { get; set; }
        public DbSet<Like> Likes { get; set; }
        public DbSet<Comment> Comments { get; set; }
        public DbSet<Reel> Reels { get; set; }
        public DbSet<ReelLike> ReelLikes { get; set; }
        public DbSet<ReelComment> ReelComments { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ── USER ──────────────────────────────────────────────────
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Username).IsUnique();
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email).IsUnique();

            // ── FRIENDSHIP ────────────────────────────────────────────
            modelBuilder.Entity<Friendship>()
                .HasOne(f => f.Requester).WithMany()
                .HasForeignKey(f => f.RequesterId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Friendship>()
                .HasOne(f => f.Addressee).WithMany()
                .HasForeignKey(f => f.AddresseeId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Friendship>()
                .HasIndex(f => new { f.RequesterId, f.AddresseeId })
                .IsUnique();

            // ── POST ──────────────────────────────────────────────────
            modelBuilder.Entity<Post>()
                .HasOne(p => p.User).WithMany()
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // ── LIKE ──────────────────────────────────────────────────
            modelBuilder.Entity<Like>()
                .HasOne(l => l.Post).WithMany(p => p.Likes)
                .HasForeignKey(l => l.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Like>()
                .HasOne(l => l.User).WithMany()
                .HasForeignKey(l => l.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Like>()
                .HasIndex(l => new { l.PostId, l.UserId }).IsUnique();

            // ── COMMENT ───────────────────────────────────────────────
            modelBuilder.Entity<Comment>()
                .HasOne(c => c.Post).WithMany(p => p.Comments)
                .HasForeignKey(c => c.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Comment>()
                .HasOne(c => c.User).WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // ── REEL ──────────────────────────────────────────────────
            modelBuilder.Entity<Reel>()
                .HasOne(r => r.User).WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // ── REEL LIKE ─────────────────────────────────────────────
            modelBuilder.Entity<ReelLike>()
                .HasOne(l => l.Reel).WithMany(r => r.Likes)
                .HasForeignKey(l => l.ReelId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ReelLike>()
                .HasOne(l => l.User).WithMany()
                .HasForeignKey(l => l.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ReelLike>()
                .HasIndex(l => new { l.ReelId, l.UserId }).IsUnique();

            // ── REEL COMMENT ──────────────────────────────────────────
            modelBuilder.Entity<ReelComment>()
                .HasOne(c => c.Reel).WithMany(r => r.Comments)
                .HasForeignKey(c => c.ReelId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ReelComment>()
                .HasOne(c => c.User).WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}