import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const ensureProfileExists = async (currentUser) => {
    if (!currentUser) return null;
    try {
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingProfile) {
        return existingProfile;
      }

      // Profile doesn't exist, let's restore it from localStorage or user metadata
      let pendingData = null;
      try {
        const key = `pending_profile_${currentUser.id}`;
        const stored = localStorage.getItem(key);
        if (stored) {
          pendingData = JSON.parse(stored);
          localStorage.removeItem(key);
        }
      } catch (e) {
        console.error('Error reading pending profile from localStorage:', e);
      }

      // Fallback to raw_user_meta_data
      if (!pendingData && currentUser.raw_user_meta_data) {
        pendingData = {
          email: currentUser.email,
          role: currentUser.raw_user_meta_data.role || 'student',
          name: currentUser.raw_user_meta_data.name || '',
          department: currentUser.raw_user_meta_data.department || '',
          phone_number: currentUser.raw_user_meta_data.phone_number || '',
          division: currentUser.raw_user_meta_data.division || null,
          prp_code: currentUser.raw_user_meta_data.prp_code || null,
          roll_number: currentUser.raw_user_meta_data.roll_number || null,
        };
      }

      if (pendingData) {
        const { data: insertedProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([{
            id: currentUser.id,
            ...pendingData
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        return insertedProfile;
      }
    } catch (err) {
      console.error('Failed to ensure profile exists:', err);
    }
    return null;
  };

  const fetchProfile = async (userId, currentUser = null) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('JSON object requested, multiple (or no) rows returned')) {
          const resolvedProfile = await ensureProfileExists(currentUser || user);
          if (resolvedProfile) {
            setProfile(resolvedProfile);
            return;
          }
        }
        throw error;
      }
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Get current session
    const initializeAuth = async () => {
      try {
        const isRecovery = window.location.hash.includes('type=recovery');

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (isRecovery) {
          // Clear the hash and change path before router mounts
          window.history.replaceState(null, '', '/update-password');
        }

        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id, session.user);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error getting session:', error);
        setLoading(false);
      }
    };

    // Add a safety timeout so the app always renders even if Supabase is unreachable
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    initializeAuth().finally(() => clearTimeout(timeout));

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(async () => {
          await fetchProfile(session.user.id, session.user);
        }, 0);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password, profileData) => {
    // 1. Sign up with Supabase Auth - pass profile details in user metadata options.data
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          ...profileData
        }
      }
    });
    
    if (authError) throw authError;

    if (authData.user) {
      // If session is returned immediately (email confirmation is off)
      if (authData.session) {
        // Insert into profiles table
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: authData.user.id,
            email,
            ...profileData
          }]);

        if (profileError) throw profileError;
      } else {
        // Email confirmation is on. Save the profile data to localStorage temporarily
        localStorage.setItem(`pending_profile_${authData.user.id}`, JSON.stringify({
          email,
          ...profileData
        }));
      }
    }
    
    return authData;
  };

  const verifyOtp = async (email, token, type = 'signup') => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });
    if (error) throw error;
    
    // Ensure the profile is created once verification is successful and session is established
    if (data?.user) {
      await ensureProfileExists(data.user);
    }
    return data;
  };

  const resendOtp = async (email, type = 'signup') => {
    const { data, error } = await supabase.auth.resend({
      email,
      type,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };
  
  const resetPassword = async (email) => {
     const { error } = await supabase.auth.resetPasswordForEmail(email);
     if (error) throw error;
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user);
    }
  };

  const value = {
    user,
    profile,
    signIn,
    signUp,
    verifyOtp,
    resendOtp,
    signOut,
    resetPassword,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '1.5rem', backgroundColor: 'var(--bg-color)' }}>
          <div className="loader"></div>
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Loading...</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
