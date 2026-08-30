@extends('layouts.app')

@section('title', 'Perfect Strategy')
@section('body-class', 'game-page')

@push('head')
    @vite(['resources/css/game.css', 'resources/css/strategy.css', 'resources/js/game/strategy.ts'])
@endpush

@section('content')
    <main id="table" class="table">
        <a class="table__exit" href="{{ route('menu') }}" data-sound="click">‹ Menu</a>
        <div class="table__topright">
            <button class="table__ruleset" id="ruleset-toggle" title="Switch ruleset (International / Cherry)" aria-label="Switch ruleset"></button>
            <button class="table__mute" id="mute" title="Toggle sound" aria-label="Toggle sound">🔊</button>
        </div>

        <div class="coach-topbar">
            <div class="coach-scorecard" id="coach-scorecard"></div>
            <button class="btn btn--ghost coach-chart-toggle" id="coach-chart-toggle" aria-expanded="false">🎯 Strategy chart</button>
        </div>

        <div class="coach-chart" id="coach-chart" hidden></div>

        <section class="dealer">
            <div class="hand" id="dealer-hand"></div>
            <div class="pill" id="dealer-total" hidden></div>
        </section>

        <div class="banner" id="banner" hidden></div>
        <div class="coach-review" id="coach-review" hidden></div>

        <section class="player">
            <div class="hands" id="player-hands"></div>
        </section>

        <footer class="dock">
            <div class="coach-hint" id="coach-hint" hidden></div>

            <div class="dock__info">
                <div class="counter"><span class="counter__label">Chips</span><span class="counter__value" id="chips">0</span></div>
                <div class="counter"><span class="counter__label">Bet</span><span class="counter__value" id="bet">0</span></div>
            </div>

            <div class="dock__row" id="bet-controls">
                <div class="chip-rack" id="chip-rack"></div>
                <button class="btn btn--ghost" id="clear-bet">Clear</button>
                <button class="btn btn--primary" id="deal" disabled>Deal</button>
            </div>

            <div class="dock__row" id="action-controls" hidden>
                <button class="btn" data-action="hit">Hit</button>
                <button class="btn" data-action="stand">Stand</button>
                <button class="btn" data-action="double">Double</button>
                <button class="btn" data-action="split">Split</button>
                <button class="btn" data-action="surrender">Surrender</button>
            </div>

            <div class="dock__row dock__row--insurance" id="insurance-controls" hidden>
                <span class="insurance-q">Insurance?</span>
                <button class="btn" data-insurance="yes">Yes</button>
                <button class="btn btn--ghost" data-insurance="no">No</button>
            </div>
        </footer>
    </main>
@endsection
