import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Search, User, LogOut, Settings, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NotificationBell from '../NotificationBell';

// Debounce utility
function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function searchAll(query) {
  if (!query) return [];
  // Use backend search endpoint (admin-only)
  const token = localStorage.getItem('auth_token');
  const res = await axios.get('/api/search', {
    params: { q: query },
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data?.results || [];
}

// Highlight search match with transparent yellow (for dropdown results)
function highlightSearch(text, search) {
  if (!text || typeof text !== 'string') return text;
  const q = search && search.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = String(text).split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="bg-yellow-400/25 rounded px-0.5">{part}</span>
    ) : (
      part
    )
  );
}

const Header = ({ onToggleSidebar, onMobileMenu }) => {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const avatarRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const navigate = useNavigate();

  // Search state
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef(null);

  // Debounced search
  const debouncedSearch = useRef(
    debounce(async (value) => {
      if (!value.trim()) {
        setSearchResults([]);
        setShowSearchDropdown(false);
        setSearchLoading(false);
        return;
      }
      setSearchLoading(true);
      try {
        const results = await searchAll(value.trim());
        setSearchResults(results);
        setShowSearchDropdown(true);
      } catch (e) {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
      setSearchLoading(false);
    }, 400)
  ).current;

  // Handle search input
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    debouncedSearch(value);
  };

  // Handle search result click - navigate to the appropriate page with search param
  const handleResultClick = (result) => {
    setShowSearchDropdown(false);
    const searchTerm = result.label;
    setSearch('');
    
    // Navigate to the appropriate page based on result type
    switch (result.type) {
      case 'Asset':
        navigate(`/assets?search=${encodeURIComponent(searchTerm)}`);
        break;
      case 'User':
        navigate(`/users?search=${encodeURIComponent(searchTerm)}`);
        break;
      case 'Ticket':
        navigate(`/tickets?search=${encodeURIComponent(searchTerm)}`);
        break;
      case 'Credential':
        navigate(`/credentials?search=${encodeURIComponent(searchTerm)}`);
        break;
      case 'VPS':
        navigate(`/vps?search=${encodeURIComponent(searchTerm)}`);
        break;
      case 'Subscription':
        navigate(`/subscriptions?search=${encodeURIComponent(searchTerm)}`);
        break;
      default:
        console.log('Unknown result type:', result.type);
    }
  };

  // Close dropdown on outside click or Escape
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target) &&
        !document.getElementById('global-search-dropdown')?.contains(event.target)
      ) {
        setShowSearchDropdown(false);
      }
    }
    function handleEscape(event) {
      if (event.key === 'Escape') setShowSearchDropdown(false);
    }
    if (showSearchDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showSearchDropdown]);

  // Handle dropdown open/close and position
  const handleAvatarClick = () => {
    if (!showDropdown && avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8, // 8px below avatar
        left: rect.right - 192 // 192px = dropdown width
      });
    }
    setShowDropdown((v) => !v);
  };

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (
        avatarRef.current &&
        !avatarRef.current.contains(event.target) &&
        !document.getElementById('user-menu-portal')?.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  return (
    <header className="glass-morphism border-b border-white/10 px-2 sm:px-4 md:px-6 py-3 md:py-4 w-full">
      <div className="flex items-center justify-between gap-2 md:gap-4">
        {/* Hamburger for mobile */}
        <div className="flex items-center gap-2 md:gap-4">
          <button
            className="md:hidden p-2 rounded-lg glass-morphism-hover text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all duration-200"
            onClick={onMobileMenu}
            aria-label="Open sidebar menu"
          >
            <Menu className="w-7 h-7" />
          </button>
          <div className="relative w-full xs:w-56 sm:w-64 md:w-80 max-w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search assets, users, tickets, VPS, subs…"
              className="input-field pl-10 w-full"
              value={search}
              onChange={handleSearchChange}
              ref={searchInputRef}
              onFocus={() => { if (search.trim()) setShowSearchDropdown(true); }}
              autoComplete="off"
            />
            {showSearchDropdown && (searchLoading || searchResults.length > 0) && ReactDOM.createPortal(
              <div
                id="global-search-dropdown"
                className="fixed z-[2000] w-80 bg-[#0a0e1a] border border-cyan-400/20 rounded-xl shadow-2xl mt-2 py-2"
                style={{
                  top: (searchInputRef.current?.getBoundingClientRect().bottom || 0) + 4,
                  left: searchInputRef.current?.getBoundingClientRect().left || 0,
                }}
              >
                {searchLoading && (
                  <div className="px-4 py-3 text-slate-400 text-sm">Searching...</div>
                )}
                {!searchLoading && searchResults.length === 0 && (
                  <div className="px-4 py-3 text-slate-400 text-sm">No results found.</div>
                )}
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    className="w-full text-left px-4 py-3 hover:bg-cyan-900/40 text-slate-100 text-sm flex items-center gap-2"
                    onClick={() => handleResultClick(result)}
                  >
                    <span className="font-bold text-cyan-400">{result.type}:</span> {highlightSearch(result.label, search)}
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 md:space-x-4">
          <NotificationBell />
          <div className="flex items-center space-x-2 md:space-x-3">
            <div className="text-right hidden xs:block">
              <p className="text-xs md:text-sm font-medium text-white">{user?.fullname}</p>
              <p className="text-[10px] md:text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
            <div className="relative">
              <button
                ref={avatarRef}
                className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center text-white font-medium"
                onClick={handleAvatarClick}
              >
                {user?.fullname?.charAt(0)}
              </button>
              {showDropdown && ReactDOM.createPortal(
                <div
                  id="user-menu-portal"
                  className="fixed w-36 glass-morphism rounded-lg border border-cyan-400 z-[1000] opacity-100 visible transition-all duration-200"
                  style={{ top: dropdownPos.top, left: dropdownPos.left }}
                >
                <div className="p-2 space-y-1">
                  <button className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors" onClick={() => { setShowDropdown(false); navigate('/settings?tab=profile&view=1'); }}>
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                  <button className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors" onClick={() => { setShowDropdown(false); navigate('/settings'); }}>
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                  <hr className="border-white/10 my-1" />
                  <button 
                    onClick={logout}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
                </div>,
                document.body
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;