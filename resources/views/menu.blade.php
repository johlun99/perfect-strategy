@extends('layouts.app')

@section('title', 'Blackjack — Choose a Mode')
@section('body-class', 'menu-page')

@push('head')
    @vite(['resources/css/menu.css', 'resources/js/menu.ts'])
@endpush

@section('content')
    <main class="menu">
        <header class="menu__header">
            <h1 class="menu__title">Blackjack</h1>
            <p class="menu__subtitle">Choose your table</p>
        </header>

        <div class="menu__tiles">
            <a class="tile tile--active" href="{{ route('blackjack') }}" data-sound="click">
                <span class="tile__icon">♠</span>
                <span class="tile__name">Pure Blackjack</span>
                <span class="tile__desc">Classic play against the dealer. Chips, splits, doubles &amp; more.</span>
                <span class="tile__cta">Play →</span>
            </a>

            <div class="tile tile--disabled" aria-disabled="true">
                <span class="badge">Coming soon</span>
                <span class="tile__icon">🔢</span>
                <span class="tile__name">Card Count</span>
                <span class="tile__desc">Drill counting card values against the clock.</span>
            </div>

            <a class="tile tile--active" href="{{ route('strategy') }}" data-sound="click">
                <span class="tile__icon">🎯</span>
                <span class="tile__name">Perfect Strategy</span>
                <span class="tile__desc">Practice optimal play and get flagged when you slip.</span>
                <span class="tile__cta">Practice →</span>
            </a>
        </div>
    </main>
@endsection
