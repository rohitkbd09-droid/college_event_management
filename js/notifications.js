// Notification handling
document.addEventListener('DOMContentLoaded', () => {
    const notificationIcon = document.getElementById('notificationIcon');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationBadge = document.getElementById('notificationBadge');
    let notifications = [];
    let userId = localStorage.getItem('userId'); // Get logged in user's ID

    // Toggle notification dropdown
    notificationIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationDropdown.classList.toggle('show');
        if (notificationDropdown.classList.contains('show')) {
            loadNotifications();
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!notificationIcon.contains(e.target)) {
            notificationDropdown.classList.remove('show');
        }
    });

    // Load notifications from the server
    async function loadNotifications() {
        if (!userId) {
            notificationDropdown.innerHTML = '<div class="notification-empty">Please log in to view notifications</div>';
            return;
        }

        try {
            const response = await fetch(`/api/notifications/${userId}`);
            const data = await response.json();
            notifications = data;
            updateNotificationDropdown();
            updateNotificationBadge();
        } catch (error) {
            console.error('Error loading notifications:', error);
            notificationDropdown.innerHTML = '<div class="notification-empty">Failed to load notifications</div>';
        }
    }

    // Update notification dropdown content
    function updateNotificationDropdown() {
        if (notifications.length === 0) {
            notificationDropdown.innerHTML = '<div class="notification-empty">No notifications</div>';
            return;
        }

        notificationDropdown.innerHTML = notifications.map(notification => `
            <div class="notification-item ${notification.is_read ? '' : 'unread'}" data-id="${notification.id}">
                <div class="title">${notification.title}</div>
                <div class="message">${notification.message}</div>
                <div class="time">${formatTimestamp(notification.created_at)}</div>
            </div>
        `).join('');

        // Add click handlers for marking as read
        document.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', async () => {
                const notificationId = item.dataset.id;
                try {
                    await fetch(`/api/notifications/${notificationId}`, {
                        method: 'PUT'
                    });
                    item.classList.remove('unread');
                    loadNotifications(); // Refresh notifications
                } catch (error) {
                    console.error('Error marking notification as read:', error);
                }
            });
        });
    }

    // Update notification badge
    function updateNotificationBadge() {
        const unreadCount = notifications.filter(n => !n.is_read).length;
        notificationBadge.textContent = unreadCount;
        notificationBadge.style.display = unreadCount > 0 ? 'block' : 'none';
    }

    // Format timestamp to relative time
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }

    // Load notifications initially
    loadNotifications();

    // Check for new notifications periodically
    setInterval(loadNotifications, 60000); // Check every minute
});