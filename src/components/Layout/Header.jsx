import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Search, User, LogOut, Settings, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Parse from '../../config/parseConfig';

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
  // Asset search
  const assetQuery = new Parse.Query('Asset');
  assetQuery.contains('name', query);
  // User search (fullname, username, email)
  const userQueryFullname = new Parse.Query('_User');
  userQueryFullname.contains('fullname', query);
  const userQueryUsername = new Parse.Query('_User');
  userQueryUsername.contains('username', query);
  const userQueryEmail = new Parse.Query('_User');
  userQueryEmail.contains('email', query);
  const userCombined = Parse.Query.or(userQueryFullname, userQueryUsername, userQueryEmail);
  // Ticket search
  const ticketQuery = new Parse.Query('Ticket');
  ticketQuery.contains('title', query);
  // Credential search (name, username)
  const credentialQueryName = new Parse.Query('Credential');
  credentialQueryName.contains('name', query);
  const credentialQueryUsername = new Parse.Query('Credential');
  credentialQueryUsername.contains('username', query);
  const credentialCombined = Parse.Query.or(credentialQueryName, credentialQueryUsername);
  // Run all in parallel
  const [assets, users, tickets, credentials] = await Promise.all([
    assetQuery.limit(5).find(),
    userCombined.limit(5).find(),
    ticketQuery.limit(5).find(),
    credentialCombined.limit(5).find(),
  ]);
  // Format results
  return [
    ...assets.map(a => ({ type: 'Asset', label: a.get('name'), id: a.id })),
    ...users.map(u => ({ type: 'User', label: u.get('fullname') || u.get('username') || u.get('email'), id: u.id })),
    ...tickets.map(t => ({ type: 'Ticket', label: t.get('title'), id: t.id })),
    ...credentials.map(c => ({ type: 'Credential', label: c.get('name') || c.get('username'), id: c.id })),
  ];
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

  // Handle search result click
  const handleResultClick = (result) => {
    setShowSearchDropdown(false);
    setSearch('');
    // For now, just log. You can navigate to detail pages here.
    console.log('Selected:', result);
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
              placeholder="Search assets, users, tickets..."
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
                    <span className="font-bold text-cyan-400">{result.type}:</span> {result.label}
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 md:space-x-4">
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